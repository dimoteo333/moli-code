# Office Add-in Performance and PPTX Reliability Design

**Date:** 2026-07-20  
**Status:** Written specification approved  
**Scope:** Moli Code Excel and PowerPoint Add-ins on Windows

## 1. Purpose

Improve the visible response speed of the Excel and PowerPoint Add-ins relative
to direct CLI use, while preserving correctness and making PowerPoint report
generation reliable even with a small language model.

The work must produce and retain comparable artifacts at every stage. Excel is
validated with a deterministic July 2026 receipts dataset and weekly/monthly
income aggregation. PowerPoint is validated by turning a Markdown meeting
record dated 2026-07-19 into an editable A4 portrait `.pptx` manager report
using the installed WonShinhan font.

The PowerPoint Add-in must require no separately installed Python, Node.js, or
other developer runtime. The installer may continue to include its existing
sidecar runtime. The implementation may use Windows PowerShell and PowerPoint
COM because PowerPoint itself is a prerequisite for the Add-in.

## 2. Current-State Findings

The current request path is:

```text
Office task pane
  -> WebSocket
  -> Node sidecar
  -> @dobby/moli-code-sdk
  -> spawned CLI
  -> model API
```

The investigation established the following baseline facts:

- Excel and PowerPoint defer SDK query initialization until the first user
  message.
- The SDK launches the bundled `cli.js`, and the CLI then relaunches itself.
  The measured outer-to-inner process gap was 3.115 seconds.
- Non-interactive system-message construction waits for an IDE command probe.
  A missing IDE connection added 2.555 seconds in the measured SDK session.
- The measured Excel first request took 8.903 seconds from send to API start,
  12.556 seconds inside the model API, and 21.519 seconds from send to first
  completion. Warm requests took 6.266 and 5.925 seconds.
- Excel MCP initialization was about 0.1 seconds and is not a primary cause.
- PowerPoint currently supports chat attachments but does not expose a
  deterministic PowerPoint editing tool. Large attachments can also be inlined
  into the prompt, increasing token cost and latency.

The design therefore separates Add-in startup overhead from model/network time
and changes only one major latency variable per stage.

## 3. Requirements

### 3.1 Functional requirements

1. Create a deterministic one-month receipts fixture covering 2026-07-01
   through 2026-07-31.
2. Use the Excel Add-in to produce raw-data and summary content with exact
   weekly and monthly income totals.
3. Create a deterministic Markdown meeting record dated 2026-07-19.
4. Use the PowerPoint Add-in to create an editable `.pptx` manager report from
   that Markdown file.
5. The report must use A4 portrait page dimensions and the installed
   WonShinhan font.
6. PowerPoint generation must succeed through a deterministic fallback if a
   small model returns an invalid structured response.
7. Windows users must not need to install Python, Node.js, or another runtime
   separately.
8. Every stage must retain its inputs, outputs, logs, metrics, hashes, and QA
   evidence, including failure evidence.

### 3.2 Performance requirements

1. Measure task-pane connection, query startup, CLI readiness, user send, API
   start, first response, tool execution, file save, and completion separately.
2. Report task-pane-open-to-ready time instead of hiding prewarm cost.
3. Target a median send-to-API-start delay of no more than 0.5 seconds after
   readiness.
4. Target at least a 70% reduction from the observed 8.903-second first-request
   pre-API delay.
5. Remove the duplicate CLI child process in the Office SDK path.
6. Remove the irrelevant IDE connection scan from the Office SDK path.
7. Report end-to-end improvement separately from model/API variability.

### 3.3 Safety and compatibility requirements

1. The model may not generate or execute arbitrary PowerShell, COM commands,
   coordinates, or layout instructions.
2. The PowerPoint bridge accepts a narrow validated request and invokes only a
   packaged fixed script.
3. Input and output paths must resolve inside explicitly allowed session or
   artifact roots.
4. Stage outputs use unique names and do not overwrite prior artifacts.
5. Existing unrelated working-tree changes must be preserved.

## 4. Alternatives Considered

### 4.1 Office.js-only editing

Office.js avoids an external runtime and naturally targets the active deck, but
older PowerPoint hosts expose limited page-setup and object-editing APIs. It is
not the most reliable route for exact A4 page setup, deterministic pagination,
and repeatable inspection across the supported Windows environment.

### 4.2 Bundled OOXML engine

A bundled OOXML generator would avoid COM and could create files without
PowerPoint automation. However, reliably modifying a currently open deck,
coordinating file locks, rendering, and validating the result would require a
substantially larger compatibility layer.

### 4.3 Restricted PowerPoint COM bridge (selected)

A fixed PowerShell script controls the locally installed PowerPoint application
through COM. This provides native page setup, font assignment, deck editing,
saving, and reopening without a separately installed runtime. The bridge is
constrained to a typed report request and never evaluates model-authored code.

## 5. Architecture

### 5.1 Benchmark and telemetry layer

A shared event schema records monotonic timestamps and correlation IDs for both
Add-ins. Events include:

```text
taskpane_connected
query_spawn_started
cli_initialized
user_message_sent
api_request_started
first_delta_received
office_tool_started
office_tool_finished
artifact_saved
turn_completed
```

Each run writes machine-readable metrics plus a concise human-readable summary.
Cold and warm runs use the same model configuration and fixture content.

### 5.2 PowerPoint report request flow

The user invokes a constrained operation such as:

```text
/report @2026-07-19-meeting-minutes.md
```

The flow is:

1. The sidecar stores the attachment in a per-session attachment store and
   supplies a short reference identifier instead of repeatedly inlining the
   complete document.
2. The model is asked only to produce a small `ReportSpec` containing title,
   reporting date, summary, decisions, owners/actions, risks, and source notes.
3. A Zod schema validates field types, lengths, dates, collection limits, and
   table shape.
4. Invalid JSON receives one constrained repair attempt.
5. If repair fails, a deterministic Markdown parser derives the same
   `ReportSpec` from headings, lists, and tables.
6. A fixed COM report engine owns all page dimensions, typography, colors,
   margins, tables, pagination, page numbers, and save behavior.
7. The result is reopened and inspected before being accepted.

The run records whether content came from `llm`, `json-repair`, or
`markdown-fallback`. Layout is always produced by the fixed engine.

### 5.3 Restricted COM bridge

The sidecar launches a packaged PowerShell script by fixed path and passes a
validated request through a data channel rather than constructing executable
command text. The request contains only:

- canonical source attachment path or reference;
- canonical output path;
- validated `ReportSpec` data;
- controlled operation mode, such as create report or save report copy.

The script is compatible with the Windows-provided PowerShell 5.1 runtime. It
uses the PowerPoint COM object model to create or edit a presentation, sets the
slide size to A4 portrait (210 x 297 mm, approximately 595.28 x 841.89 points),
resolves the installed display name for the requested `원신한` font, applies it
to all report text, builds the fixed report layout, saves the `.pptx`, reopens
it, and returns structured verification data. A missing matching font is an
explicit failure rather than a silent substitution. Arbitrary shell commands,
script fragments, and raw COM method names are not accepted.

### 5.4 Startup optimization

The optimization sequence is intentionally incremental:

1. Instrument the complete path without changing runtime behavior.
2. Add the deterministic PowerPoint report capability.
3. Start query initialization when the task pane WebSocket handshake completes,
   rather than on the first message.
4. Remove the redundant SDK/CLI relaunch while keeping normal interactive CLI
   behavior compatible.
5. Add an explicit Office SDK initialization profile that skips IDE probing and
   command loading not required by the Add-in.
6. Optimize attachment transport only if stage metrics show that it remains a
   material bottleneck.

## 6. Error Handling

### 6.1 Content errors

- Missing or unreadable Markdown produces a typed attachment error.
- Schema validation errors trigger at most one JSON repair.
- A failed repair activates deterministic Markdown fallback.
- A fallback parse with insufficient report content fails explicitly and
  preserves the parser diagnostics.

### 6.2 PowerPoint errors

- PowerPoint unavailable, COM activation failure, file lock, font absence, save
  failure, and reopen failure use distinct error codes.
- Output is first written to a unique staging path. Only a reopened and verified
  file is promoted to the stage output location.
- A failed run keeps logs and safe intermediate evidence but is never reported
  as a successful `.pptx` result.

### 6.3 Performance and lifecycle errors

- Query prewarm failure is surfaced in the task pane and may retry once on the
  next user send; it must not create unbounded processes.
- Sidecar shutdown terminates its owned query process and closes telemetry.
- Correlation IDs connect task-pane, sidecar, SDK, CLI, tool, and artifact logs.

## 7. Test Fixtures

### 7.1 Excel fixture

Use a fixed seed to generate transactions for every day from 2026-07-01 through
2026-07-31. The fixture stores the generated rows and precomputed expected
weekly/monthly totals. Weeks follow ISO Monday-through-Sunday boundaries, with
partial weeks clipped to the month: July 1-5, 6-12, 13-19, 20-26, and 27-31.

The output workbook must contain:

- a raw receipts sheet;
- a weekly summary sheet or clearly separated weekly summary table;
- a monthly summary sheet or clearly separated monthly summary table;
- values that exactly match the fixture oracle.

### 7.2 PowerPoint fixture

Create a stable Korean Markdown meeting record for 2026-07-19 with agenda,
discussion summary, decisions, action owners and due dates, and risks. The output
is a single editable `.pptx`; PDF is not required.

The report verifier checks:

- the file opens without a repair prompt;
- slide dimensions are A4 portrait within a small numeric tolerance;
- expected title, date, sections, decisions, and owners appear;
- all report text uses WonShinhan;
- the deck contains no obvious text overflow or off-slide objects;
- the file can be saved and reopened through PowerPoint COM.

## 8. Stage Artifacts

All evidence is retained under:

```text
artifacts/addin-performance/2026-07-20/
  fixtures/
    excel/
    powerpoint/
  stage-00-baseline/
  stage-01-observability/
  stage-02-ppt-com-engine/
  stage-03-query-prewarm/
  stage-04-single-cli-process/
  stage-05-minimal-sdk-init/
  stage-06-attachment-optimization/
```

Every executed stage stores, as applicable:

- fixture and exact prompt;
- `.xlsx` and `.pptx` output;
- raw logs;
- `metrics.json` and a comparison summary;
- SHA-256 hashes;
- functional and visual QA results;
- screenshots or rendered evidence when available;
- measurement path: `actual-taskpane`, `full-path-harness`, or `manual-smoke`;
- failure logs and intermediate evidence when output creation fails.

Stage 06 is executed only when the preceding measurements prove attachment
transport remains material. If it is skipped, the evidence records the reason.
Stage 00 records the current behavior as-is. If the current PowerPoint Add-in
cannot create a `.pptx`, the failed request, timing, logs, and absence of a file
are the valid baseline rather than a fabricated successful output.

## 9. Benchmark Method

For each stage and each Add-in:

1. Preserve the exact build and test configuration.
2. Run one cold measurement.
3. Run three warm measurements.
4. Use the warm median for comparisons.
5. Validate the resulting Office artifact before treating the timing as valid.
6. Compare absolute milliseconds and percentage improvement with Stage 00.

Actual task-pane automation is attempted first. If WebView2 prevents reliable
automation, the complete WebSocket-sidecar-SDK-CLI path is measured with a
deterministic harness and the actual Office file is verified separately. The
baseline and final build also receive an actual Office task-pane smoke test.
Every reported result names the measurement path used.

Network and model time are not counted as Add-in overhead. They remain visible
in end-to-end timing so the user can see both engineering improvement and actual
experience.

## 10. Stage Gates

A stage passes only if:

1. Its new unit and integration tests pass.
2. Existing relevant tests pass.
3. Excel values or PowerPoint artifact checks pass, as applicable.
4. No orphaned or duplicate CLI process remains.
5. Cold/warm timing and raw evidence are retained.
6. A functional regression is not traded for a faster number.

Implementation follows test-driven development: add a failing focused test,
confirm the failure, implement the smallest behavior that satisfies the stage,
then run relevant regression and actual Add-in verification before continuing.

## 11. Acceptance Criteria

The project is complete when current evidence proves all of the following:

- identical fixtures were used across executed stages;
- Excel weekly and monthly totals exactly match the oracle;
- an editable A4 portrait WonShinhan `.pptx` is produced from the Markdown
  meeting record without a separately installed runtime;
- forced invalid small-model output still succeeds through deterministic
  fallback;
- the final Add-ins pass actual Office smoke tests;
- duplicate CLI relaunch and Office-path IDE probing are absent;
- timing shows send-to-API and end-to-end changes with raw measurements;
- every executed stage retains its artifacts and validation evidence;
- any skipped conditional stage has an evidence-backed explanation.
