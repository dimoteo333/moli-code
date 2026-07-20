# PowerPoint Template Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Extend the Windows PowerPoint Add-in so a user can attach a slightly varying one-page A4 template, paste prose minutes, and create a template-preserving one-to-three-page PPTX through one GLM turn in less than 50 seconds.

**Architecture:** The task pane transports a PPTX as validated base64 only to the localhost sidecar. A special /template-report turn asks the already-prewarmed GLM session for a bounded JSON report schema while suppressing raw JSON from the UI. A local Node orchestrator validates or falls back from that JSON, and a bundled Windows PowerShell COM engine maps semantic template slots, duplicates the template slide, fills one to three pages, saves, and reopens the PPTX.

**Tech Stack:** TypeScript, Vitest, Office.js ES5 task pane, WebSocket JSON protocol, Moli SDK query session, Node child_process, Windows PowerShell 5.1, PowerPoint COM.

## Global Constraints

- Final demonstration model: Qwen3.6 35B; this PC validates with its existing GLM connection only.
- Every GLM cold 1 / warm 3 run must complete within 50,000 ms.
- One model turn only; no model retry or repair turn.
- Output is PPTX only, one to three A4 portrait pages.
- Preserve template logo, header, footer, color, font, and page-number conventions.
- Support small template variations without hardcoding shape IDs or exact coordinates.
- The template contract is one A4 portrait slide with title/meta, three ordered section regions, and an optional table in the middle region.
- Target Windows PCs require PowerPoint and Windows PowerShell 5.1, but no Python or system Node.js.
- Keep all paths inside the configured Add-in work directory.
- Do not modify SDK, Core, or CLI.

---

### Task 1: Binary PPTX Attachment Protocol

**Files:**

- Modify: packages/powerpoint-addin/src/shared/attachment-limits.ts
- Modify: packages/powerpoint-addin/src/shared/messages.ts
- Modify: packages/powerpoint-addin/src/taskpane/file-attachments.ts
- Modify: packages/powerpoint-addin/src/taskpane/chat-ui.ts
- Modify: packages/powerpoint-addin/src/sidecar/ws-server.ts
- Modify: packages/powerpoint-addin/test/file-attachments.test.ts
- Modify: packages/powerpoint-addin/test/messages.test.ts

**Interfaces:**

- Produces: LocalFileAttachment.encoding as utf8 or base64.
- Produces: readLocalFile(file) supporting text and .pptx.
- Consumes: existing attachment pills and @filename references.

- [ ] **Step 1: Write failing binary attachment tests**

```ts
it('accepts a pptx up to 10 MiB as base64', async () => {
  const file = new File(
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
    'template.pptx',
    {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    },
  );
  const attachment = await readLocalFile(file);
  expect(attachment).toMatchObject({
    name: 'template.pptx',
    encoding: 'base64',
    size: 4,
  });
  expect(attachment.content).toBe('UEsDBA==');
});

it('rejects a pptx larger than 10 MiB', async () => {
  const file = new File([new Uint8Array(MAX_TEMPLATE_BYTES + 1)], 'large.pptx');
  await expect(readLocalFile(file)).rejects.toThrow('FILE_TOO_LARGE');
});
```

- [ ] **Step 2: Run and verify RED**

Run: npm test -- --run test/file-attachments.test.ts test/messages.test.ts

Expected: FAIL because .pptx and encoding are unsupported.

- [ ] **Step 3: Extend the shared wire type and limits**

```ts
export const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;

export interface LocalFileAttachment {
  name: string;
  content: string;
  size: number;
  mimeType?: string;
  encoding?: 'utf8' | 'base64';
}
```

Default omitted encoding to utf8 for backwards compatibility. Add .pptx to FILE_PICKER_ACCEPT. Rename readLocalTextFile to readLocalFile and keep a compatibility export if existing callers require it.

Use FileReader.readAsArrayBuffer for PPTX and a chunk-safe Uint8Array-to-base64 helper that never spreads a 10 MiB array into function arguments:

```ts
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    const end = Math.min(offset + chunk, bytes.length);
    for (let index = offset; index < end; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
  }
  return btoa(binary);
}
```

Text attachments retain the existing 256 KiB and NUL checks. chat-ui must count template size separately from MAX_TOTAL_FILE_CHARS and allow at most one base64 PPTX. Set WebSocketServer maxPayload explicitly to 16 MiB so one 10 MiB PPTX plus base64/JSON overhead succeeds but oversized frames are rejected.

- [ ] **Step 4: Run and verify GREEN**

Run: npm test -- --run test/file-attachments.test.ts test/messages.test.ts

Expected: all attachment and protocol tests pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/powerpoint-addin/src/shared packages/powerpoint-addin/src/taskpane packages/powerpoint-addin/test
git commit -m "feat(powerpoint-addin): accept local PPTX templates"
```

---

### Task 2: Secure Template Storage and Fixed Report Schema

**Files:**

- Create: packages/powerpoint-addin/src/sidecar/template-attachment.ts
- Create: packages/powerpoint-addin/src/sidecar/template-report-spec.ts
- Create: packages/powerpoint-addin/test/template-attachment.test.ts
- Create: packages/powerpoint-addin/test/template-report-spec.test.ts

**Interfaces:**

- Produces: saveTemplateAttachment(attachment, workDir): Promise<string>.
- Produces: TemplateReportSpec and TemplateReportPage types.
- Produces: buildTemplateExtractionPrompt(minutes): string.
- Produces: parseTemplateReportOutput(raw, minutes): TemplateReportSpec using a local fallback on invalid JSON.

- [ ] **Step 1: Write failing secure-storage tests**

```ts
it('stores a valid PPTX below workDir/templates', async () => {
  const path = await saveTemplateAttachment(validPptxAttachment, workDir);
  expect(path.startsWith(resolve(workDir, 'templates'))).toBe(true);
  await expect(readFile(path)).resolves.toEqual(pptxBytes);
});

it.each([
  [
    'bad base64',
    { ...validPptxAttachment, content: '***' },
    'TEMPLATE_BASE64_INVALID',
  ],
  [
    'bad signature',
    { ...validPptxAttachment, content: 'bm90LXppcA==' },
    'TEMPLATE_SIGNATURE_INVALID',
  ],
  [
    'unsafe name',
    { ...validPptxAttachment, name: '../x.pptx' },
    'TEMPLATE_NAME_INVALID',
  ],
])('rejects %s', async (_name, attachment, code) => {
  await expect(
    saveTemplateAttachment(attachment, workDir),
  ).rejects.toMatchObject({ code });
});
```

- [ ] **Step 2: Write failing schema tests**

The bounded model schema is:

```ts
export interface TemplateReportPage {
  section1: { heading: string; bullets: string[] };
  section2: {
    heading: string;
    columns: [string, string, string, string];
    rows: Array<[string, string, string, string]>;
  };
  section3: { heading: string; bullets: string[] };
}

export interface TemplateReportSpec {
  title: string;
  date: string;
  department: string;
  pages: TemplateReportPage[];
}
```

Tests must prove:

- fenced JSON is accepted;
- pages is limited to one through three;
- each narrative section has one through three bullets;
- each bullet is at most 90 Korean characters;
- each table has one through four rows and four columns;
- invalid JSON produces a deterministic one-page fallback;
- short/medium/long fixture prose produces fallback specs of one/two/three pages.

- [ ] **Step 3: Run both test files and verify RED**

Run: npm test -- --run test/template-attachment.test.ts test/template-report-spec.test.ts

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement secure template storage**

Validate name, .pptx extension, base64 encoding, declared byte size, decoded size, ZIP prefix 50 4B 03 04, 10 MiB limit, and resolved destination containment. Write to a unique file under workDir/templates using writeFile with flag wx. Do not pass binary template content to formatPromptWithAttachments.

- [ ] **Step 5: Implement prompt, parser, limits, and fallback**

The extraction prompt must require JSON only and explicitly include the field limits:

```ts
export function buildTemplateExtractionPrompt(minutes: string): string {
  return [
    '다음 줄글 회의록을 제출용 보고서 JSON으로만 변환하세요.',
    'pages는 회의록이 900자 이하면 1개, 901~1800자면 2개, 1801자 이상이면 3개입니다.',
    '각 페이지는 section1 불릿 1~3개, section2 4열 표 1~4행,',
    'section3 불릿 1~3개를 가집니다. 불릿은 90자 이하입니다.',
    '설명, Markdown 코드펜스, 도구 호출 없이 JSON만 출력하세요.',
    '<meeting_minutes>',
    minutes,
    '</meeting_minutes>',
  ].join('\n');
}
```

Strip one optional JSON fence, parse, validate every scalar and array, and normalize dates to YYYY.MM.DD. fallbackTemplateReport must split prose at sentence endings, detect YYYY-MM-DD or Korean dates, detect department suffixes, and distribute bounded sentence chunks across one to three pages without calling a model.

- [ ] **Step 6: Run and verify GREEN**

Run: npm test -- --run test/template-attachment.test.ts test/template-report-spec.test.ts

Expected: all schema/storage tests pass.

- [ ] **Step 7: Commit**

```powershell
git add packages/powerpoint-addin/src/sidecar/template-attachment.ts packages/powerpoint-addin/src/sidecar/template-report-spec.ts packages/powerpoint-addin/test/template-attachment.test.ts packages/powerpoint-addin/test/template-report-spec.test.ts
git commit -m "feat(powerpoint-addin): validate template report inputs"
```

---

### Task 3: Template-Aware PowerPoint COM Engine

**Files:**

- Create: packages/powerpoint-addin/src/sidecar/template-report-generator.ts
- Create: packages/powerpoint-addin/src/sidecar/template-report-generator.ps1
- Modify: packages/powerpoint-addin/scripts/build.js
- Create: packages/powerpoint-addin/test/template-report-generator.test.ts
- Create: scripts/tests/powerpoint-template-com.test.js

**Interfaces:**

- Consumes: templatePath, TemplateReportSpec, outputDir, allowedRoot.
- Produces: generateTemplateReport(...): Promise<string>.
- Produces: a reopened one-to-three-slide A4 PPTX.

- [ ] **Step 1: Write failing Node wrapper tests**

```ts
it('rejects a template or output outside the work root', async () => {
  await expect(
    generateTemplateReport(
      'C:\\outside\\template.pptx',
      spec,
      'C:\\safe\\reports',
      'C:\\safe',
    ),
  ).rejects.toThrow('REPORT_PATH_OUTSIDE_WORKDIR');
});

it('passes a UTF-8 JSON spec to a hidden PowerShell process', async () => {
  const result = await generateTemplateReport(template, spec, reports, workDir);
  expect(result).toMatch(/\.pptx$/i);
});
```

- [ ] **Step 2: Write an actual PowerPoint COM integration test**

On Windows with PowerPoint installed, generate from the supplied repository template.pptx using fixed one-, two-, and three-page specs. Reopen each result and assert:

```js
expect(verification).toMatchObject({
  pageCounts: [1, 2, 3],
  a4: true,
  reopened: true,
  missingRequiredText: [],
  offSlideObjects: 0,
  overflowShapes: 0,
});
```

- [ ] **Step 3: Run and verify RED**

Run:

```powershell
npm test -- --run test/template-report-generator.test.ts
npx vitest run scripts/tests/powerpoint-template-com.test.js
```

Expected: FAIL because the template generator does not exist.

- [ ] **Step 4: Implement the Node wrapper**

Resolve all paths and require templatePath, outputDir, the temporary spec path, and output path to remain under allowedRoot. Write the spec JSON as UTF-8. Use execFile with:

```ts
{
  windowsHide: true,
  timeout: 15_000,
  maxBuffer: 1024 * 1024,
}
```

Invoke powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File template-report-generator.ps1. Convert timeout, font, mapping, open, save, and reopen failures into stable error codes.

- [ ] **Step 5: Implement semantic slot mapping in PowerShell**

Open the template read-only and inspect only slide 1. Build descriptors for every shape: Id, Type, Left, Top, Width, Height, Text, FontName, FontSize, Bold, HasTable.

Select slots without using fixed IDs:

- title: largest text size in the top 22% excluding logo/header text;
- date: top-third text matching YYYY.MM.DD, YYYY-MM-DD, or a date placeholder;
- department: top-third short text containing 부, 팀, 본부, or 사업부;
- table: the first HasTable shape in the body;
- section headings: short bold body text sorted by Top, preferring text containing 제목, 개요, 결과, 과제, 리스크, 요청;
- narrative bodies: nonbold text shapes immediately below the first and third heading;
- page number: centered short numeric text in the bottom 8%.

If any required slot is ambiguous or missing, throw TEMPLATE_SLOT_NOT_FOUND with the slot name.

- [ ] **Step 6: Fill and paginate by cloning the template slide**

Save a copy of the template to a unique temporary output and reopen it for editing. Keep slide 1 for page 1. Duplicate the original template slide for every additional spec page, never duplicate an already-filled slide.

For each page:

- replace title and append (2/3) only when the template has no page-number shape;
- replace date and department;
- replace the three headings;
- fill section1 and section3 with bullet lines;
- resize the existing table to header plus one through four rows;
- fill its four columns and rows;
- preserve the existing font name, font size, fill, border, alignment, logo, header, and footer;
- update the page-number text when present;
- remove unresolved placeholder tokens from body slots only.

Use TextFrame2.TextRange.BoundHeight and the shape height to reject overflow; do not shrink below the template's original body font size. Verify every shape stays within 595.25 by 841.88 points with a 0.5-point tolerance.

Save, close, reopen read-only, re-run slide count, size, required text, font, boundary, and overflow checks, then atomically move the temporary file to the final output.

- [ ] **Step 7: Copy the engine in the build**

Extend build.js's current BOM-copy step so template-report-generator.ps1 is copied to dist/sidecar with a UTF-8 BOM beside report-generator.ps1.

- [ ] **Step 8: Run tests and verify GREEN**

Run:

```powershell
npm test -- --run test/template-report-generator.test.ts
npx vitest run scripts/tests/powerpoint-template-com.test.js
```

Expected: Node unit tests and actual one/two/three-page PowerPoint COM tests pass.

- [ ] **Step 9: Commit**

```powershell
git add packages/powerpoint-addin/src/sidecar packages/powerpoint-addin/scripts/build.js packages/powerpoint-addin/test/template-report-generator.test.ts scripts/tests/powerpoint-template-com.test.js
git commit -m "feat(powerpoint-addin): fill variable A4 report templates"
```

---

### Task 4: One-Turn GLM Orchestration

**Files:**

- Modify: packages/powerpoint-addin/src/sidecar/session.ts
- Modify: packages/powerpoint-addin/test/session.test.ts

**Interfaces:**

- Consumes: /template-report, pasted prose, and one base64 PPTX attachment.
- Produces: one hidden structured GLM turn followed by artifact_saved and a user-visible PPTX path.
- Reuses: the prewarmed Query and InputQueue.

- [ ] **Step 1: Write failing session tests**

Tests must prove:

- /template-report requires exactly one PPTX attachment and nonempty prose;
- template bytes are never included in the GLM prompt;
- the special prompt is enqueued on the existing prewarmed query;
- assistant JSON deltas/messages are captured but not forwarded to the pane;
- result success triggers generateTemplateReport once;
- invalid JSON triggers the local fallback without a second inputQueue push;
- another user message during generation receives TEMPLATE_REPORT_BUSY;
- a 45-second timer interrupts the query and returns TEMPLATE_REPORT_TIMEOUT;
- success emits artifact_saved and exactly one turn_complete.

Use fake timers for the timeout test.

- [ ] **Step 2: Run and verify RED**

Run: npm test -- --run test/session.test.ts

Expected: new template-report tests fail.

- [ ] **Step 3: Add explicit template turn state**

```ts
interface ActiveTemplateTurn {
  turnId: number;
  templatePath: string;
  minutes: string;
  streamedText: string;
  finalText: string;
  timeout: ReturnType<typeof setTimeout>;
  completed: boolean;
}

private activeTemplateTurn: ActiveTemplateTurn | null = null;
```

handleUserMessage must route /template-report before formatPromptWithAttachments so the base64 attachment is never formatted into the model prompt. Strip both the /template-report command and the automatically inserted @template.pptx token from the pasted prose. Save the template, create ActiveTemplateTurn, push buildTemplateExtractionPrompt(minutes), emit user_message_enqueued, and start a 45,000 ms watchdog.

- [ ] **Step 4: Capture and finish the model turn**

Make handleSdkMessage async and await it from pumpMessages. When activeTemplateTurn matches the current turn:

- append top-level text deltas to streamedText and replace finalText from the final assistant text block;
- suppress assistant_delta, assistant_message, and thinking frames;
- reject any tool_use through canUseTool for this turn;
- on result, clear the timer, parse finalText when present and otherwise streamedText, call generateTemplateReport, emit artifact_saved, send a concise Korean completion message with the path, then send turn_complete;
- on model error, use fallback prose rather than retrying the model;
- clear state exactly once in finally.

The watchdog calls queryInstance.interrupt(), sends TEMPLATE_REPORT_TIMEOUT, and marks the state completed so a late result is ignored.

- [ ] **Step 5: Run and verify GREEN**

Run: npm test -- --run test/session.test.ts

Expected: all old /report tests and all new /template-report tests pass.

- [ ] **Step 6: Commit**

```powershell
git add packages/powerpoint-addin/src/sidecar/session.ts packages/powerpoint-addin/test/session.test.ts
git commit -m "feat(powerpoint-addin): orchestrate one-turn template reports"
```

---

### Task 5: Prose Fixtures and Binary Benchmark Support

**Files:**

- Create: scripts/addin-performance/powerpoint-demo-fixtures.mjs
- Modify: scripts/addin-performance/run-sidecar-benchmark.mjs
- Create: scripts/tests/powerpoint-demo-fixtures.test.js
- Modify: scripts/tests/sidecar-benchmark.test.js
- Output: artifacts/addin-demo/2026-07-20/powerpoint/\*

**Interfaces:**

- Produces: short.txt, medium.txt, long.txt and prompt.txt.
- Consumes: --template path for a base64 PPTX attachment.
- Produces: raw frames and metrics for /template-report.

- [ ] **Step 1: Write failing fixture tests**

The three fixtures must be natural Korean prose without Markdown headings or tables. Each includes meeting date, department, decisions, named owners, deadlines, and a risk/approval request. The test asserts:

- short length 500-900 Korean characters;
- medium length 1,200-1,800;
- long length 2,200-3,200;
- all contain 2026-07-19 and four named owners;
- none contains Markdown heading or pipe-table syntax.

- [ ] **Step 2: Write failing benchmark attachment test**

```js
expect(buildTemplateAttachment(templateBytes, 'template.pptx')).toEqual({
  name: 'template.pptx',
  content: templateBytes.toString('base64'),
  size: templateBytes.length,
  mimeType:
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  encoding: 'base64',
});
```

- [ ] **Step 3: Run and verify RED**

Run: npx vitest run scripts/tests/powerpoint-demo-fixtures.test.js scripts/tests/sidecar-benchmark.test.js

Expected: fixture builder and --template support are missing.

- [ ] **Step 4: Generate the prose and exact prompt**

prompt.txt must be:

```text
/template-report

아래 줄글 회의록을 첨부한 제출양식에 맞춰 PPTX 보고서로 만드세요.
내용 길이에 따라 1~3페이지로 나누고 결과 파일만 저장하세요.
```

The harness must concatenate the selected prose after this prompt and attach template.pptx as base64. It must never read the PPTX as UTF-8.

- [ ] **Step 5: Run and verify GREEN**

Run: npx vitest run scripts/tests/powerpoint-demo-fixtures.test.js scripts/tests/sidecar-benchmark.test.js

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add scripts/addin-performance/powerpoint-demo-fixtures.mjs scripts/addin-performance/run-sidecar-benchmark.mjs scripts/tests/powerpoint-demo-fixtures.test.js scripts/tests/sidecar-benchmark.test.js
git commit -m "test(powerpoint-addin): add prose template-report benchmark"
```

---

### Task 6: GLM Timing, Template Variants, and Visual QA

**Files:**

- Modify: packages/powerpoint-addin/README.md
- Create: artifacts/addin-demo/2026-07-20/powerpoint/README.md
- Create: artifacts/addin-demo/2026-07-20/powerpoint/metrics.json

**Interfaces:**

- Consumes: installed final PowerPoint sidecar, repository template.pptx, prose fixtures.
- Produces: one/two/three-page PPTX outputs, renders, COM verification, hashes, and cold/warm timings.

- [ ] **Step 1: Build and install the Add-in**

Run:

```powershell
npm test
npm run typecheck
npm run build
```

Expected: all existing and new tests pass, sidecar/taskpane typechecks pass, ES5 gate passes, and both PowerShell engines are present in dist/sidecar.

- [ ] **Step 2: Create one slight template variation**

Through PowerPoint COM, copy the supplied template and move the title/date within the top region, rename placeholder text, widen the table, and preserve A4 size and the same three-section contract. This proves shape IDs and exact coordinates are not required. Retain both templates as test inputs.

- [ ] **Step 3: Generate 1/2/3-page outputs**

Run the installed sidecar once for short, medium, and long prose. Assert page counts 1, 2, and 3. Run each output through PowerPoint COM reopen checks and slides_test.py overflow checks. Render every page and inspect each page individually at full size.

Expected: logo/header/footer/fonts/colors remain template-derived, all required owners/dates appear, no off-slide objects, no unresolved placeholders, no clipping or unintended overlap.

- [ ] **Step 4: Run GLM cold 1 / warm 3 under 50 seconds**

Use medium.txt for the canonical performance run because it exercises duplication and table filling. Run four turns through one WSS connection:

- run 1 cold;
- runs 2-4 warm;
- each run hard limit 50,000 ms;
- total watchdog 205,000 ms.

Expected: each sendToArtifactMs and sendToCompleteMs is below 50,000, every result has two pages, and no error frame is recorded.

- [ ] **Step 5: Document the live demo**

README must instruct:

- choose the actual template.pptx before the timed portion;
- paste medium.txt as plain prose;
- run /template-report and start the stopwatch on Send;
- show the tool activity, then open the saved PPTX;
- point out repeated corporate header/footer and the automatically generated second page;
- local measurements are GLM proxy evidence;
- run the same medium input at least once with Qwen3.6 35B before the event.

- [ ] **Step 6: Rebuild the offline ZIP and verify contents**

The final PowerPoint offline ZIP must contain one each of:

- sidecar/node.exe
- cli/cli.js
- sidecar/index.cjs
- sidecar/report-generator.ps1
- sidecar/template-report-generator.ps1

No Python executable or package directory is required.

- [ ] **Step 7: Commit code/docs and retain generated artifacts untracked**

```powershell
git add packages/powerpoint-addin/README.md
git commit -m "docs(powerpoint-addin): document variable template demo"
```

Retain PPTX, rendered PNG, raw frames, verification JSON, metrics, and offline ZIP under artifacts/addin-demo/2026-07-20/powerpoint without committing the binaries.
