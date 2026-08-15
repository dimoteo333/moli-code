# Office Add-in Performance and PPTX Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Excel and PowerPoint Add-ins measurably faster than the current baseline and make A4 WonShinhan PowerPoint report generation reliable with small models and no separately installed runtime.

**Architecture:** Add structured timing to both sidecars, retain deterministic benchmark artifacts, and optimize cold startup one cause at a time. PowerPoint `/report` requests use a validated `ReportSpec`, one model repair attempt, deterministic Markdown fallback, and a fixed Windows PowerShell 5.1/PowerPoint COM layout engine; model-authored code is never executed.

**Tech Stack:** TypeScript, Vitest, Node.js 20 bundled with the Add-in, Office.js, `@dobby/moli-code-sdk`, Zod, Windows PowerShell 5.1, PowerPoint COM, PowerShell/Office automation for verification.

## Global Constraints

- Preserve the user's existing `sea-config.json` modification and `.playwright-mcp/` files.
- Use a dedicated `codex/office-addin-performance` worktree before implementation.
- Use test-driven development for every behavior change: RED, minimal GREEN, regression test, stage benchmark.
- PowerPoint users install no Python, Node.js, or developer runtime separately; use only the bundled sidecar runtime, Windows PowerShell 5.1, and installed PowerPoint.
- Never execute model-authored PowerShell, COM method names, coordinates, or layout instructions.
- Use an A4 portrait slide size of 595.28 by 841.89 points and fail on missing `원신한` font rather than silently substitute.
- Retain one cold run and three warm runs per Add-in per executed stage and report the warm median.
- Keep task-pane-open-to-ready, send-to-API-start, API/model, tool, save, and end-to-end intervals separate.
- A stage does not pass unless its Office artifact passes content and format verification.
- Store generated evidence under `artifacts/addin-performance/2026-07-20/`; do not overwrite earlier stage files.

## File Structure

- `scripts/addin-performance/lib.mjs`: deterministic fixtures, metric reduction, hashing, and stage directory helpers.
- `scripts/addin-performance/generate-fixtures.mjs`: writes the July receipts oracle and 2026-07-19 Korean meeting Markdown.
- `scripts/addin-performance/run-sidecar-benchmark.mjs`: drives the real WebSocket-sidecar-SDK-CLI path and records event timestamps.
- `scripts/addin-performance/verify-office.ps1`: verifies `.xlsx` and `.pptx` through installed Office COM.
- `scripts/tests/addin-performance.test.js`: fixture and metric unit tests.
- `packages/*-addin/src/sidecar/performance.ts`: compact structured performance event recorder for deployable sidecars.
- `packages/*-addin/test/performance.test.ts`: performance event tests.
- `packages/powerpoint-addin/src/sidecar/report-spec.ts`: `ReportSpec` schema, JSON extraction, and one-repair contract.
- `packages/powerpoint-addin/src/sidecar/markdown-report.ts`: deterministic Markdown-to-`ReportSpec` fallback.
- `packages/powerpoint-addin/src/sidecar/powerpoint-report.ts`: safe request validation and fixed COM-process orchestration.
- `packages/powerpoint-addin/src/sidecar/powerpoint-report-mcp.ts`: narrow embedded MCP tool for validated report creation.
- `packages/powerpoint-addin/assets/create-report.ps1`: fixed PowerShell 5.1/PowerPoint COM report engine.
- `packages/powerpoint-addin/test/report-spec.test.ts`: schema, repair, and fallback tests.
- `packages/powerpoint-addin/test/powerpoint-report.test.ts`: path safety and process protocol tests.
- `packages/powerpoint-addin/test/powerpoint-report-mcp.test.ts`: tool result and deterministic fallback integration tests.
- `packages/powerpoint-addin/scripts/build.js`: copies the fixed COM script into the build.
- `packages/powerpoint-addin/scripts/package-deploy.js`: includes the COM script in the offline package.
- `packages/excel-addin/src/sidecar/session.ts`: timing events and query prewarm.
- `packages/powerpoint-addin/src/sidecar/session.ts`: report workflow, timing events, and query prewarm.
- `packages/sdk-typescript/src/transport/ProcessTransport.ts`: pass the SDK channel marker and no-relaunch marker to the CLI.
- `packages/cli/src/gemini.tsx`: skip the redundant relaunch only for the SDK-owned child.
- `packages/cli/src/utils/nonInteractiveHelpers.ts`: skip slash-command and IDE discovery for SDK initialization.
- Relevant existing unit tests beside each modified source file.

---

### Task 1: Create deterministic fixtures, metric reducer, and Stage 00 evidence

**Files:**

- Create: `scripts/addin-performance/lib.mjs`
- Create: `scripts/addin-performance/generate-fixtures.mjs`
- Create: `scripts/addin-performance/run-sidecar-benchmark.mjs`
- Create: `scripts/addin-performance/verify-office.ps1`
- Create: `scripts/tests/addin-performance.test.js`
- Modify: `scripts/tests/vitest.config.ts`
- Modify: `package.json`
- Create at runtime: `artifacts/addin-performance/2026-07-20/fixtures/**`
- Create at runtime: `artifacts/addin-performance/2026-07-20/stage-00-baseline/**`

**Interfaces:**

- Produces: `generateReceipts(seed): { rows, weeks, monthTotal }`.
- Produces: `summarizeRun(events): BenchmarkSummary` and `median(values)`.
- Produces: a CLI accepting `--app`, `--stage`, `--port`, `--prompt`, and optional attachment arguments.
- Produces: stable fixture files consumed unchanged by every later stage.

- [ ] **Step 1: Write the failing fixture and reducer tests**

Add `.test.js` to the Vitest include list and test these exact invariants:

```js
import { describe, expect, it } from 'vitest';
import {
  generateReceipts,
  median,
  summarizeRun,
} from '../addin-performance/lib.mjs';

describe('add-in performance fixtures', () => {
  it('generates July 2026 rows with stable ISO week totals', () => {
    const fixture = generateReceipts(20260719);
    expect(fixture.rows[0].date).toBe('2026-07-01');
    expect(fixture.rows.at(-1).date).toBe('2026-07-31');
    expect(fixture.weeks.map((week) => [week.from, week.to])).toEqual([
      ['2026-07-01', '2026-07-05'],
      ['2026-07-06', '2026-07-12'],
      ['2026-07-13', '2026-07-19'],
      ['2026-07-20', '2026-07-26'],
      ['2026-07-27', '2026-07-31'],
    ]);
    expect(fixture.weeks.reduce((sum, week) => sum + week.total, 0)).toBe(
      fixture.monthTotal,
    );
  });

  it('reduces monotonic events without mixing model and add-in time', () => {
    expect(
      summarizeRun([
        { name: 'user_message_sent', atMs: 100 },
        { name: 'api_request_started', atMs: 600 },
        { name: 'first_delta_received', atMs: 1600 },
        { name: 'artifact_saved', atMs: 2100 },
      ]),
    ).toMatchObject({
      sendToApiMs: 500,
      apiToFirstDeltaMs: 1000,
      sendToArtifactMs: 2000,
    });
    expect(median([600, 100, 300])).toBe(300);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:scripts -- --run scripts/tests/addin-performance.test.js`

Expected: FAIL because `scripts/addin-performance/lib.mjs` does not exist.

- [ ] **Step 3: Implement deterministic generation and metric reduction**

Use a fixed linear congruential generator, one transaction per calendar day,
amounts rounded to 1,000 KRW, and ISO Monday-Sunday ranges clipped to July.
Write JSON with UTF-8, two-space indentation, and a SHA-256 sibling file. The
meeting Markdown must contain `회의일: 2026-07-19`, agenda, decisions, actions
with owners/due dates, and risks. `summarizeRun` must return undefined for an
interval whose endpoint is absent rather than infer a value.

The WebSocket runner must fetch `/token`, send a real protocol `hello`, record
all structured performance frames/log markers, and store its exact prompt,
measurement path, configuration, raw frames, and summary. It must not claim to
have used the actual task pane; its path value is `full-path-harness`.

The verifier script accepts exactly:

```powershell
param(
    [ValidateSet('excel','powerpoint')][string]$App,
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$OutputJson
)
```

For Excel it opens read-only, reads raw/weekly/monthly ranges, and emits their
values. For PowerPoint it opens without a window, emits slide width/height,
slide count, every text run font, every text box bounds, and reopen success.
Both branches close documents and call `Quit()` in `finally` blocks.

- [ ] **Step 4: Run unit tests and fixture generation**

Run: `npm run test:scripts -- --run scripts/tests/addin-performance.test.js`

Expected: PASS.

Run: `node scripts/addin-performance/generate-fixtures.mjs`

Expected: creates the fixture JSON, expected totals, Markdown, and hashes under
`artifacts/addin-performance/2026-07-20/fixtures/`.

- [ ] **Step 5: Capture the unmodified Stage 00 baseline**

Run the installed Excel Add-in cold once and warm three times with the fixture
prompt. Attempt actual task-pane automation first; if unavailable, use the
full-path harness and perform a real Excel manual smoke/COM artifact check.
Repeat for PowerPoint with `/report @2026-07-19-meeting-minutes.md`. Preserve a
PowerPoint failure as the baseline when the current build cannot create PPTX.

Expected: `stage-00-baseline/{excel,powerpoint}/` contains prompt, logs, raw
events, metrics, hashes, output when present, and a truthful `measurementPath`.

- [ ] **Step 6: Commit Task 1**

```powershell
git add package.json scripts/addin-performance scripts/tests/vitest.config.ts scripts/tests/addin-performance.test.js
git commit -m "test: add Office add-in performance fixtures and harness"
```

Do not commit generated benchmark artifacts; retain them in the worktree and
copy them to the final handoff location.

### Task 2: Add structured sidecar timing without changing behavior

**Files:**

- Create: `packages/excel-addin/src/sidecar/performance.ts`
- Create: `packages/powerpoint-addin/src/sidecar/performance.ts`
- Create: `packages/excel-addin/test/performance.test.ts`
- Create: `packages/powerpoint-addin/test/performance.test.ts`
- Modify: `packages/excel-addin/src/sidecar/session.ts`
- Modify: `packages/powerpoint-addin/src/sidecar/session.ts`
- Modify: `packages/excel-addin/src/shared/messages.ts`
- Modify: `packages/powerpoint-addin/src/shared/messages.ts`
- Modify: `packages/cli/src/nonInteractiveCli.ts`
- Modify: `packages/cli/src/nonInteractiveCli.test.ts`

**Interfaces:**

- Produces: `PerformanceRecorder.mark(name, fields?)` with monotonic elapsed milliseconds and correlation fields.
- Produces: optional `performance_event` frames consumed by the benchmark runner.
- Produces: an SDK-only `MOLI_PERF` stderr marker immediately before the real model stream request.
- Preserves current lazy query startup for Stage 01.

- [ ] **Step 1: Write failing recorder and session tests**

```ts
it('emits monotonic performance events with session and turn correlation', () => {
  const emitted: unknown[] = [];
  const recorder = new PerformanceRecorder(
    'session-1',
    (event) => emitted.push(event),
    () => 42,
  );
  recorder.mark('user_message_sent', { turnId: 3 });
  expect(emitted).toEqual([
    {
      type: 'performance_event',
      name: 'user_message_sent',
      elapsedMs: 42,
      sessionId: 'session-1',
      turnId: 3,
    },
  ]);
});
```

Add session assertions that construction emits `taskpane_connected`, first send
emits `user_message_sent` before `query_spawn_started`, SDK `system/init` emits
`cli_initialized`, first text delta emits `first_delta_received` once per turn,
and `result` emits `turn_completed`.

Add a CLI test that `config.getChannel() === 'SDK'` writes exactly one structured
`api_request_started` marker immediately before `sendMessageStream`, while a
non-SDK invocation writes none.

- [ ] **Step 2: Run both suites and verify RED**

Run: `npm test --workspace=packages/excel-addin -- test/performance.test.ts test/session.test.ts`

Run: `npm test --workspace=packages/powerpoint-addin -- test/performance.test.ts test/session.test.ts`

Expected: FAIL on the missing recorder and frame type.

- [ ] **Step 3: Implement the recorder and wire event points**

Use `performance.now()` when available in the Node sidecar and inject a clock in
tests. Extend the wire union with this exact shape:

```ts
export interface PerformanceEventFrame {
  v: number;
  type: 'performance_event';
  name:
    | 'taskpane_connected'
    | 'query_spawn_started'
    | 'cli_initialized'
    | 'user_message_sent'
    | 'api_request_started'
    | 'first_delta_received'
    | 'office_tool_started'
    | 'office_tool_finished'
    | 'artifact_saved'
    | 'turn_completed';
  elapsedMs: number;
  sessionId: string;
  turnId?: number;
  toolName?: string;
  artifactPath?: string;
}
```

Also write the same JSON as one `[perf]` logger line. Do not start the query in
the constructor in this task. In `nonInteractiveCli.ts`, write
`MOLI_PERF {"name":"api_request_started"}` to stderr only for the SDK channel
immediately before `geminiClient.sendMessageStream`. Parse this fixed prefix in
each sidecar's existing `stderr` callback and mark `api_request_started` on the
sidecar clock; all other stderr remains ordinary debug logging.

- [ ] **Step 4: Run tests, typecheck, and Stage 01 benchmark**

Run: `npm test --workspace=packages/excel-addin && npm run typecheck --workspace=packages/excel-addin`

Run: `npm test --workspace=packages/powerpoint-addin && npm run typecheck --workspace=packages/powerpoint-addin`

Expected: PASS.

Build/install each Add-in and repeat cold-one/warm-three. Expected functional
behavior matches Stage 00 and `stage-01-observability` contains the new event
timeline.

- [ ] **Step 5: Commit Task 2**

```powershell
git add packages/excel-addin packages/powerpoint-addin
git add packages/cli/src/nonInteractiveCli.ts packages/cli/src/nonInteractiveCli.test.ts
git commit -m "feat: instrument Office add-in request latency"
```

### Task 3: Implement `ReportSpec` validation and deterministic Markdown fallback

**Files:**

- Create: `packages/powerpoint-addin/src/sidecar/report-spec.ts`
- Create: `packages/powerpoint-addin/src/sidecar/markdown-report.ts`
- Create: `packages/powerpoint-addin/test/report-spec.test.ts`
- Modify: `packages/powerpoint-addin/package.json`

**Interfaces:**

- Produces: `ReportSpec`, `ReportSpecSchema: z.ZodType<ReportSpec>`, and strict runtime validation.
- Produces: `parseReportSpecJson(text): ReportSpec`.
- Produces: `parseMeetingMarkdown(markdown, sourceName): ReportSpec`.
- Produces: `buildRepairPrompt(validationMessage, previousText): string` for one repair attempt.

Use this exact public shape:

```ts
export interface ReportAction {
  task: string;
  owner: string;
  dueDate: string;
  status?: string;
}

export interface ReportRisk {
  risk: string;
  mitigation?: string;
}

export interface ReportSpec {
  title: string;
  reportDate: string;
  summary: string;
  decisions: string[];
  actions: ReportAction[];
  risks: ReportRisk[];
  sourceName: string;
}
```

- [ ] **Step 1: Write failing schema and fallback tests**

The tests must prove valid Korean content parses, overlong fields fail, fenced
JSON extracts correctly, and malformed model output falls back to Markdown.

```ts
it('parses the deterministic meeting record without a model', () => {
  const spec = parseMeetingMarkdown(
    MEETING_MARKDOWN,
    '2026-07-19-meeting-minutes.md',
  );
  expect(spec.reportDate).toBe('2026-07-19');
  expect(spec.decisions.length).toBeGreaterThan(0);
  expect(spec.actions[0]).toMatchObject({
    owner: expect.any(String),
    dueDate: expect.stringMatching(/^2026-/),
  });
  expect(ReportSpecSchema.parse(spec)).toEqual(spec);
});

it('rejects model-authored layout or script fields', () => {
  expect(() =>
    ReportSpecSchema.parse({
      ...VALID_SPEC,
      powershell: 'Start-Process calc',
      coordinates: [1, 2],
    }),
  ).toThrow();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test --workspace=packages/powerpoint-addin -- test/report-spec.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the strict schema and parser**

Use `z.object(...).strict()` with these bounds: title 1-100, report date ISO
date, summary 1-800, 1-12 decisions, 1-20 actions, 0-10 risks, string cells
1-300, and source name 1-255. Normalize Markdown headings by Korean and English
aliases, parse bullet lists, and parse action tables with columns for task,
owner, and due date. The fallback must reject a document with no date, no
summary, and no decisions/actions.

`buildRepairPrompt` must request JSON only, repeat the schema field names and
limits, and explicitly forbid layout, shell, COM, and code fields.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test --workspace=packages/powerpoint-addin -- test/report-spec.test.ts`

Run: `npm run typecheck --workspace=packages/powerpoint-addin`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add packages/powerpoint-addin/package.json packages/powerpoint-addin/src/sidecar/report-spec.ts packages/powerpoint-addin/src/sidecar/markdown-report.ts packages/powerpoint-addin/test/report-spec.test.ts package-lock.json
git commit -m "feat: add deterministic meeting report specification"
```

### Task 4: Build the fixed PowerPoint COM report engine

**Files:**

- Create: `packages/powerpoint-addin/assets/create-report.ps1`
- Create: `packages/powerpoint-addin/src/sidecar/powerpoint-report.ts`
- Create: `packages/powerpoint-addin/test/powerpoint-report.test.ts`
- Modify: `packages/powerpoint-addin/scripts/build.js`
- Modify: `packages/powerpoint-addin/scripts/package-deploy.js`

**Interfaces:**

- Consumes: validated `ReportSpec` from Task 3.
- Produces: `createPowerPointReport(request, deps): Promise<ReportResult>` for `create` and `update-copy` operations.
- Produces: fixed script JSON output `{ ok, outputPath, slideCount, widthPoints, heightPoints, fonts, overflowWarnings }`.

Use these exact orchestration types:

```ts
export type ReportOperation = 'create' | 'update-copy';

export interface PowerPointReportRequest {
  spec: ReportSpec;
  operation: ReportOperation;
  allowedRoot: string;
  outputPath: string;
  sourcePresentationPath?: string;
}

export interface PowerPointReportResult {
  ok: true;
  outputPath: string;
  slideCount: number;
  widthPoints: number;
  heightPoints: number;
  fonts: string[];
  overflowWarnings: string[];
}

export interface PowerPointReportDeps {
  scriptPath: string;
  runPowerShell: (
    executable: string,
    args: string[],
    stdinJson: string,
    timeoutMs: number,
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}
```

- [ ] **Step 1: Write failing path and process-protocol tests**

```ts
it('rejects output paths outside the configured work directory', async () => {
  await expect(
    createPowerPointReport(
      {
        spec: VALID_SPEC,
        outputPath: 'C:\\Windows\\escape.pptx',
        allowedRoot: TEMP_ROOT,
      },
      FAKE_DEPS,
    ),
  ).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ALLOWED_ROOT' });
});

it('passes JSON by stdin to a fixed script path', async () => {
  const calls: unknown[] = [];
  const result = await createPowerPointReport(VALID_REQUEST, fakeDeps(calls));
  expect(calls[0]).toMatchObject({
    file: 'powershell.exe',
    args: [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      expect.stringMatching(/create-report\.ps1$/),
    ],
  });
  expect(result.ok).toBe(true);
});

it('updates an existing presentation only through a saved copy', async () => {
  const calls: Array<{ stdinJson: string }> = [];
  const result = await createPowerPointReport(
    {
      ...VALID_REQUEST,
      operation: 'update-copy',
      sourcePresentationPath: SOURCE_DECK,
    },
    fakeDeps(calls),
  );
  expect(result.outputPath).not.toBe(SOURCE_DECK);
  expect(JSON.parse(calls[0].stdinJson).sourcePresentationPath).toBe(
    SOURCE_DECK,
  );
});
```

Also test malformed stdout, nonzero exit, timeout, missing font, reopen failure,
and existing output collision as distinct typed errors.

- [ ] **Step 2: Run and verify RED**

Run: `npm test --workspace=packages/powerpoint-addin -- test/powerpoint-report.test.ts`

Expected: FAIL because `powerpoint-report.ts` does not exist.

- [ ] **Step 3: Implement the safe TypeScript bridge**

Canonicalize with `path.resolve`, compare using case-insensitive Windows path
segments, require `.pptx`, and allow only `create` or `update-copy`. For
`update-copy`, require a source `.pptx` inside the allowed root and prohibit the
output path from matching it. Create a unique staging name in the allowed root,
and use `spawn('powershell.exe', fixedArgs, { windowsHide: true, shell: false })`.
Write only JSON to stdin. Cap execution at 120 seconds, collect bounded stdout
and stderr, validate returned JSON, require the returned path to match staging,
then rename to the unique final path only after `ok === true`.

- [ ] **Step 4: Implement the fixed PowerShell 5.1 engine**

The script must:

1. read all request JSON from standard input;
2. validate the request contains only `spec`, `operation`, `stagingPath`,
   optional `sourcePresentationPath`, and `fontCandidates`;
3. activate `PowerPoint.Application` through COM;
4. resolve `원신한` from installed PowerPoint font names and fail if absent;
5. create a new deck for `create`, or open the requested source deck and save a
   working copy for `update-copy` without overwriting the source;
6. set the working deck to A4 portrait at 595.28 by 841.89 points;
7. use fixed Shinhan colors, margins, and type sizes;
8. create cover/summary, decisions, actions, and risks pages with deterministic pagination;
9. apply the resolved font to every text range;
10. add page numbers and source/date footer;
11. save as Open XML Presentation, close, reopen, and inspect dimensions/fonts/bounds;
12. emit one compressed JSON result to stdout;
13. close presentations, call `Quit()`, and release COM objects in `finally`.

No request value may be evaluated as code or used as a COM member name.

- [ ] **Step 5: Package and test the asset**

Update `build.js` to copy `assets/create-report.ps1` to
`dist/sidecar-assets/create-report.ps1`. Update `package-deploy.js` to copy that
directory to `deploy/sidecar-assets`. Add a test or build assertion that the
packaged file exists and is byte-identical to the source.

Run: `npm test --workspace=packages/powerpoint-addin`

Run: `npm run build --workspace=packages/powerpoint-addin`

Expected: PASS and the fixed script exists in `dist/sidecar-assets/`.

- [ ] **Step 6: Run the real COM integration test**

Use the fixture `ReportSpec` and invoke the packaged script with the real
Windows PowerShell and installed PowerPoint. Run `verify-office.ps1` on the
result. Expected: editable `.pptx`, A4 portrait dimensions, all text in the
resolved `원신한` font, expected content, no off-slide object, reopen success.
Run the same engine in `update-copy` mode against a small seed deck and prove
the source hash is unchanged while the saved copy contains the generated report.

- [ ] **Step 7: Commit Task 4**

```powershell
git add packages/powerpoint-addin/assets packages/powerpoint-addin/src/sidecar/powerpoint-report.ts packages/powerpoint-addin/test/powerpoint-report.test.ts packages/powerpoint-addin/scripts/build.js packages/powerpoint-addin/scripts/package-deploy.js
git commit -m "feat: add restricted PowerPoint COM report engine"
```

### Task 5: Integrate `/report`, model repair, and deterministic fallback

**Files:**

- Create: `packages/powerpoint-addin/src/sidecar/powerpoint-report-mcp.ts`
- Create: `packages/powerpoint-addin/test/powerpoint-report-mcp.test.ts`
- Modify: `packages/powerpoint-addin/src/sidecar/attachments.ts`
- Modify: `packages/powerpoint-addin/src/sidecar/session.ts`
- Modify: `packages/powerpoint-addin/test/attachments.test.ts`
- Modify: `packages/powerpoint-addin/test/session.test.ts`

**Interfaces:**

- Consumes: attachment content, `ReportSpecSchema`, Markdown fallback, and COM bridge.
- Produces: embedded MCP tool `powerpoint_create_report` accepting only `ReportSpec` fields and `attachmentId`.
- Produces: report run state `llm | json-repair | markdown-fallback` recorded in logs and artifact metadata.

- [ ] **Step 1: Write failing tool and session tests**

Cover these cases:

- valid model tool input creates one report and marks `llm`;
- invalid first JSON is followed by one repair prompt;
- invalid repair calls `parseMeetingMarkdown` and still creates a report;
- model completes without calling the tool and fallback creates the report;
- fallback is never run after a successful tool call;
- `/report` requires exactly one Markdown attachment;
- normal chat attachments retain existing behavior until conditional Task 9.

```ts
it('creates a report through deterministic fallback when the model omits the tool', async () => {
  const session = makeReportSession({
    modelMessages: [{ type: 'result', is_error: false }],
  });
  session.sendReport(MEETING_ATTACHMENT);
  await session.finished;
  expect(session.createReport).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'markdown-fallback' }),
  );
  expect(session.framesOfType('turn_complete').at(-1)).toMatchObject({
    isError: false,
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test --workspace=packages/powerpoint-addin -- test/powerpoint-report-mcp.test.ts test/session.test.ts test/attachments.test.ts`

Expected: FAIL because the report MCP server and run state do not exist.

- [ ] **Step 3: Implement an attachment store and narrow MCP tool**

Validate attachments once, store immutable content by random per-session ID,
and return metadata `{ id, name, mimeType, size, sha256 }`. Do not expose a
filesystem path to the model. The report tool schema repeats `ReportSpecSchema`
fields plus an attachment ID; output file names are generated by the sidecar.

The model prompt says to call `powerpoint_create_report` once with content only.
It explicitly states that layout, coordinates, scripts, and COM are controlled
by the Add-in. If the tool arguments fail schema validation, send exactly one
repair turn. If it fails again or the turn ends without a successful tool call,
run Markdown fallback locally.

- [ ] **Step 4: Wire telemetry and user-visible completion**

Emit `office_tool_started`, `office_tool_finished`, and `artifact_saved`. Send a
Korean assistant message containing the final file name, source path label
(`LLM`, `JSON 복구`, or `Markdown 폴백`), and QA status. A failed COM or fallback
must send a typed error and `turn_complete.isError = true`.

- [ ] **Step 5: Run all PowerPoint tests and Stage 02 actual test**

Run: `npm test --workspace=packages/powerpoint-addin`

Run: `npm run typecheck --workspace=packages/powerpoint-addin`

Expected: PASS.

Build/package/install the PowerPoint Add-in, then run **both** Add-ins cold once
and warm three times through their actual task panes when possible. Excel is the
unchanged control for this stage. PowerPoint also receives a forced malformed
model-output run. Verify the Excel totals and each PPTX through COM and retain
all evidence in `stage-02-ppt-com-engine/{excel,powerpoint}`.

- [ ] **Step 6: Commit Task 5**

```powershell
git add packages/powerpoint-addin/src/sidecar packages/powerpoint-addin/test
git commit -m "feat: make PowerPoint report generation model-resilient"
```

### Task 6: Prewarm the SDK query after authenticated task-pane hello

**Files:**

- Modify: `packages/excel-addin/src/sidecar/session.ts`
- Modify: `packages/excel-addin/test/session.test.ts`
- Modify: `packages/powerpoint-addin/src/sidecar/session.ts`
- Modify: `packages/powerpoint-addin/test/session.test.ts`

**Interfaces:**

- Produces: constructor starts one query after sending `hello_ok`.
- Preserves: first user message enters the already-running streaming input queue.
- Produces: one retry on first send only when prewarm failed synchronously.

- [ ] **Step 1: Replace lazy-start expectations with failing prewarm tests**

```ts
it('prewarms exactly one query on authenticated session construction', () => {
  const ws = new FakeWs();
  const session = makeSession(ws);
  expect(captured).toHaveLength(1);
  session.onFrame(frame({ type: 'user_message', text: 'go' }));
  expect(captured).toHaveLength(1);
});

it('disposal aborts a prewarmed query before any user message', () => {
  const session = makeSession(new FakeWs());
  session.dispose('test');
  expect(captured[0].interrupt).not.toHaveBeenCalled();
  expect(captured[0].options.abortController.signal.aborted).toBe(true);
});
```

- [ ] **Step 2: Run and verify RED**

Run both package session test files. Expected: FAIL because `captured` remains
empty until the first message.

- [ ] **Step 3: Call `ensureQuery()` from each constructor**

Send `hello_ok` first, then invoke a guarded `startPrewarm()` method. Store a
typed startup error. On the first user message only, retry if the stored failure
was synchronous and no query exists. Never create more than one live query.
Record `query_spawn_started` at actual start and surface prewarm failure through
the existing Korean error frame.

- [ ] **Step 4: Run tests, build, and Stage 03 benchmark**

Run both Add-in unit suites, typechecks, and builds. Install both Add-ins and
capture cold one/warm three. Record both pane-open-to-ready and send-to-API so
prewarm cost is visible. Retain outputs and QA under `stage-03-query-prewarm`.

- [ ] **Step 5: Commit Task 6**

```powershell
git add packages/excel-addin/src/sidecar/session.ts packages/excel-addin/test/session.test.ts packages/powerpoint-addin/src/sidecar/session.ts packages/powerpoint-addin/test/session.test.ts
git commit -m "perf: prewarm Office add-in agent sessions"
```

### Task 7: Remove the duplicate CLI relaunch for SDK-owned processes

**Files:**

- Modify: `packages/sdk-typescript/src/transport/ProcessTransport.ts`
- Modify: `packages/sdk-typescript/test/unit/ProcessTransport.test.ts`
- Modify: `packages/cli/src/gemini.tsx`
- Modify: `packages/cli/src/gemini.test.tsx`

**Interfaces:**

- Produces: SDK transport passes `MOLI_SDK_NO_RELAUNCH=1` in its child environment.
- Consumes: CLI checks both `--channel=SDK` and the marker before skipping relaunch.
- Preserves: normal CLI, CI, VSCode, ACP, sandbox, and direct stream-json relaunch behavior.

- [ ] **Step 1: Write failing transport and CLI tests**

```ts
it('marks its spawned CLI as an SDK-owned no-relaunch child', () => {
  new ProcessTransport({ pathToMoliExecutable: 'moli' });
  expect(mockSpawn).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Array),
    expect.objectContaining({
      env: expect.objectContaining({ MOLI_SDK_NO_RELAUNCH: '1' }),
    }),
  );
});
```

Add CLI tests proving `relaunchAppInChildProcess` is not called only when both
the SDK channel and marker are present, and remains called when either is absent.

- [ ] **Step 2: Run and verify RED**

Run: `npm test --workspace=packages/sdk-typescript -- test/unit/ProcessTransport.test.ts`

Run: `npm test --workspace=packages/cli -- src/gemini.test.tsx`

Expected: FAIL on missing marker and unconditional relaunch.

- [ ] **Step 3: Implement the two-factor relaunch bypass**

In `ProcessTransport.initialize`, merge the fixed marker after caller env so a
caller cannot unset it. In `gemini.tsx`, compute:

```ts
const sdkOwnsProcess =
  argv.channel === 'SDK' && process.env['MOLI_SDK_NO_RELAUNCH'] === '1';
if (!sdkOwnsProcess) {
  await relaunchAppInChildProcess(memoryArgs, []);
}
```

Do not change sandbox relaunch logic.

- [ ] **Step 4: Run SDK/CLI regressions and Stage 04 benchmark**

Run package tests, typechecks, and Add-in builds. Inspect the process tree during
a real request and store evidence that there is one CLI process per session.
Repeat cold/warm Add-in tests and Office artifact QA into
`stage-04-single-cli-process`.

- [ ] **Step 5: Commit Task 7**

```powershell
git add packages/sdk-typescript/src/transport/ProcessTransport.ts packages/sdk-typescript/test/unit/ProcessTransport.test.ts packages/cli/src/gemini.tsx packages/cli/src/gemini.test.tsx
git commit -m "perf: avoid redundant CLI relaunch for SDK sessions"
```

### Task 8: Skip IDE and slash-command discovery during SDK initialization

**Files:**

- Modify: `packages/cli/src/utils/nonInteractiveHelpers.ts`
- Modify: `packages/cli/src/utils/nonInteractiveHelpers.test.ts`
- Modify if needed by failing coverage: `packages/cli/src/nonInteractiveCliCommands.ts`
- Modify if needed by failing coverage: `packages/cli/src/nonInteractiveCliCommands.test.ts`

**Interfaces:**

- Consumes: `config.getChannel() === 'SDK'`.
- Produces: SDK system init has `slash_commands: []` without invoking `getAvailableCommands` or `ideCommand`.
- Preserves: direct noninteractive CLI slash commands and all other channel behavior.

- [ ] **Step 1: Write a failing SDK-channel system-message test**

```ts
it('does not discover slash commands for SDK initialization', async () => {
  vi.mocked(getAvailableCommands).mockResolvedValue([{ name: 'ide' }] as never);
  const config = makeConfig({ channel: 'SDK' });
  const result = await buildSystemMessage(
    config,
    'session',
    PermissionMode.DEFAULT,
  );
  expect(result.slash_commands).toEqual([]);
  expect(getAvailableCommands).not.toHaveBeenCalled();
});
```

Keep existing non-SDK tests asserting command names are present.

- [ ] **Step 2: Run and verify RED**

Run: `npm test --workspace=packages/cli -- src/utils/nonInteractiveHelpers.test.ts`

Expected: FAIL because `getAvailableCommands` is called for SDK.

- [ ] **Step 3: Short-circuit command discovery for SDK**

At the start of `loadSlashCommandNames`, return `[]` when
`config.getChannel() === 'SDK'`. Do not alter `BuiltinCommandLoader` globally;
interactive and direct CLI users retain `/ide` and all normal commands.

- [ ] **Step 4: Run CLI regressions and Stage 05 benchmark**

Run the CLI unit suite and typecheck, rebuild/package both Add-ins, and repeat
their actual/harness cold-one/warm-three tests. Confirm logs contain no IDE probe
and retain evidence under `stage-05-minimal-sdk-init`.

Evaluate acceptance targets: post-ready send-to-API median at or below 500 ms
and at least 70% below Stage 00's 8.903-second pre-API delay. A miss is reported
truthfully and investigated before completion.

- [ ] **Step 5: Commit Task 8**

```powershell
git add packages/cli/src/utils/nonInteractiveHelpers.ts packages/cli/src/utils/nonInteractiveHelpers.test.ts packages/cli/src/nonInteractiveCliCommands.ts packages/cli/src/nonInteractiveCliCommands.test.ts
git commit -m "perf: minimize SDK system initialization"
```

Stage only files that changed.

### Task 9: Optimize attachment transport only when Stage 05 proves it material

**Files:**

- Conditional modify: `packages/powerpoint-addin/src/sidecar/attachments.ts`
- Conditional modify: `packages/powerpoint-addin/test/attachments.test.ts`
- Conditional modify: `packages/powerpoint-addin/src/sidecar/session.ts`
- Create at runtime either way: `artifacts/addin-performance/2026-07-20/stage-06-attachment-optimization/decision.json`

**Interfaces:**

- Consumes: Stage 05 attachment serialization time, prompt characters, and input-token evidence.
- Produces: either an evidence-backed skip decision or bounded reference-based report attachments.

- [ ] **Step 1: Make the execute/skip decision from evidence**

Execute this task only if attachment formatting/transport contributes at least
10% of send-to-API time or the meeting file is unnecessarily repeated after its
first turn. Write `decision.json` with measured values, threshold, and decision.
Whether executed or skipped, run both Add-ins once cold and three times warm for
the stage record; Excel remains the control for a PowerPoint-only optimization.

- [ ] **Step 2A: If skipped, verify and retain the decision**

Expected: `decision.json` says `executed: false` and references Stage 05 raw
metrics. Make no product code change and do not create a code commit. Retain the
control benchmark under `stage-06-attachment-optimization/{excel,powerpoint}`.

- [ ] **Step 2B: If executed, write failing reference-store tests**

Test that the first report turn supplies the content once, later turns carry
only ID/name/hash metadata, invalid or cross-session IDs fail, and ordinary chat
attachments preserve current behavior.

- [ ] **Step 3B: Implement, test, benchmark, and commit when executed**

Keep content in the sidecar's immutable per-session store. Never send a local
path to the model. Run PowerPoint unit/type/build tests and cold/warm Stage 06
benchmarks for both Add-ins, then commit only the measured optimization:

```powershell
git add packages/powerpoint-addin/src/sidecar/attachments.ts packages/powerpoint-addin/src/sidecar/session.ts packages/powerpoint-addin/test/attachments.test.ts
git commit -m "perf: avoid repeated PowerPoint report attachments"
```

### Task 10: Final package, actual Office validation, and evidence-backed report

**Files:**

- Modify: `packages/excel-addin/README.md`
- Modify: `packages/powerpoint-addin/README.md`
- Create: `artifacts/addin-performance/2026-07-20/final-comparison.md`
- Create: `artifacts/addin-performance/2026-07-20/completion-audit.json`
- Create at runtime: final `.xlsx`, final `.pptx`, metrics, logs, screenshots, hashes, and COM verification JSON.

**Interfaces:**

- Consumes: all stage metrics and artifacts.
- Produces: installable offline packages and a requirement-by-requirement completion audit.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
npm run test:scripts
npm test --workspace=packages/sdk-typescript
npm test --workspace=packages/cli
npm test --workspace=packages/excel-addin
npm test --workspace=packages/powerpoint-addin
npm run typecheck --workspace=packages/sdk-typescript
npm run typecheck --workspace=packages/cli
npm run typecheck --workspace=packages/excel-addin
npm run typecheck --workspace=packages/powerpoint-addin
npm run build:excel-addin
npm run build:powerpoint-addin
```

Expected: all commands exit 0.

- [ ] **Step 2: Build and inspect offline packages**

Run `npm run package:excel-addin` and `npm run package:powerpoint-addin`.
Inspect the PowerPoint archive/deploy folder to prove it contains bundled
`sidecar/node.exe`, `cli/cli.js`, and `sidecar-assets/create-report.ps1`, with no
Python dependency or installer step.

- [ ] **Step 3: Install final builds and execute actual Office tests**

Close Office safely, install the two final builds, reopen Excel and PowerPoint,
and run the exact fixtures. Attempt WebView2 task-pane automation first. If it
cannot be controlled, execute the approved full-path harness plus actual Office
manual smoke. Clearly label the measurement path.

Excel output must contain raw receipts plus weekly and monthly summaries whose
totals exactly equal the fixture oracle. PowerPoint output must survive forced
invalid model output and pass all A4/font/content/bounds/reopen checks.

- [ ] **Step 4: Compare stages and complete the audit**

`final-comparison.md` must include cold and warm values, medians, absolute and
percentage changes, model/API time separated from Add-in overhead, executed or
skipped Stage 06, and every output path. `completion-audit.json` maps each design
acceptance criterion to direct evidence and marks it only `proved`, `failed`, or
`missing`.

- [ ] **Step 5: Update user documentation**

Document prewarm timing semantics, logs/artifact locations, `/report` usage,
the deterministic fallback, A4/원신한 requirements, and that no separate
Python/Node installation is needed on Windows.

- [ ] **Step 6: Commit documentation only after evidence passes**

```powershell
git add packages/excel-addin/README.md packages/powerpoint-addin/README.md
git commit -m "docs: document Office add-in performance and report workflow"
```

Keep generated benchmark artifacts available for handoff. Commit them only if
the user explicitly requests repository tracking of binary evidence.

- [ ] **Step 7: Perform final verification-before-completion**

Read `superpowers:verification-before-completion`, rerun the commands whose
output proves every acceptance criterion, inspect final Office artifacts rather
than relying on prior intent, and report any unmet criterion instead of claiming
completion.
