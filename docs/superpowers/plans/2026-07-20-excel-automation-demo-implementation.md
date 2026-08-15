# Excel Automation Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a 36-row corporate-card workbook and GLM-driven Excel Add-in demo that visibly completes validation formulas, KPI summaries, a department table, and a pre-created chart in less than 50 seconds.

**Architecture:** A deterministic JavaScript fixture module owns the raw rows and oracle. An artifact-tool builder creates a polished workbook whose result cells are blank but whose chart already targets those cells. The installed Add-in is measured through the existing WSS harness seeded with the same workbook snapshot, then its recorded Excel operations are replayed through real Excel COM into the base workbook for save/reopen and visual verification.

**Tech Stack:** JavaScript ESM, Vitest, @oai/artifact-tool, TypeScript Add-in protocol, Windows PowerShell 5.1, Excel COM.

## Global Constraints

- Final demonstration model: Qwen3.6 35B; this PC validates with its existing GLM connection only.
- Every GLM cold 1 / warm 3 run must complete within 50,000 ms.
- The workbook begins with 36 populated source rows: 28 normal and 8 exceptions.
- The Add-in must create formulas and summary values; the fixture must not pre-populate those results.
- Use the existing nine Excel MCP operations; do not add chart-generation tools.
- The chart object exists in the fixture and updates from formula-backed summary cells.
- Target Windows PCs require no Python or system Node.js installation.
- Do not modify SDK, Core, or CLI.

---

### Task 1: Deterministic Expense Dataset and Oracle

**Files:**

- Create: scripts/addin-performance/excel-demo-data.mjs
- Test: scripts/tests/excel-demo-data.test.js

**Interfaces:**

- Produces: buildExpenseDemoData() returning { headers, rows, oracle }.
- Produces: oracle with totalAmount, normalCount, exceptionCount, exceptionAmount, and byDepartment.
- Consumes: no project state; output must be deterministic.

- [ ] **Step 1: Write the failing dataset test**

```js
import { describe, expect, it } from 'vitest';
import { buildExpenseDemoData } from '../addin-performance/excel-demo-data.mjs';

describe('buildExpenseDemoData', () => {
  it('creates 36 realistic rows with exactly eight auditable exceptions', () => {
    const demo = buildExpenseDemoData();
    expect(demo.headers).toEqual([
      '거래일',
      '카드번호',
      '부서',
      '사용자',
      '가맹점',
      '비용구분',
      '금액',
      '영수증',
      '승인한도',
      '검토결과',
    ]);
    expect(demo.rows).toHaveLength(36);
    expect(demo.oracle.normalCount).toBe(28);
    expect(demo.oracle.exceptionCount).toBe(8);
    expect(Object.keys(demo.oracle.byDepartment)).toEqual([
      '디지털혁신부',
      '영업기획부',
      '고객지원부',
      '경영지원부',
    ]);
    expect(
      Object.values(demo.oracle.byDepartment).reduce(
        (sum, item) => sum + item.amount,
        0,
      ),
    ).toBe(demo.oracle.totalAmount);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: npx vitest run scripts/tests/excel-demo-data.test.js

Expected: FAIL because excel-demo-data.mjs does not exist.

- [ ] **Step 3: Implement the deterministic dataset**

Create four departments with nine rows each and fixed dates from 2026-07-01 through 2026-07-18. Use masked card numbers and Korean merchant/category names. Mark exception source facts at fixed row indexes:

```js
const MISSING_RECEIPT_INDEXES = new Set([4, 17, 29]);
const OVER_LIMIT_INDEXES = new Set([8, 22, 34]);
const DUPLICATE_PAIRS = [
  [11, 12],
  [25, 26],
];

export function classifyExpense(row, allRows, index) {
  if (row.receipt === '미첨부') return '영수증 누락';
  if (row.amount > row.limit) return '한도 초과';
  const signature = [row.date, row.user, row.merchant, row.amount].join('|');
  const duplicateSeenEarlier = allRows
    .slice(0, index)
    .some(
      (candidate) =>
        [
          candidate.date,
          candidate.user,
          candidate.merchant,
          candidate.amount,
        ].join('|') === signature,
    );
  return duplicateSeenEarlier ? '중복 의심' : '정상';
}

export function buildExpenseDemoData() {
  const sourceRows = buildFixedRows();
  const classified = sourceRows.map((row, index) => ({
    ...row,
    result: classifyExpense(row, sourceRows, index),
  }));
  return {
    headers: [
      '거래일',
      '카드번호',
      '부서',
      '사용자',
      '가맹점',
      '비용구분',
      '금액',
      '영수증',
      '승인한도',
      '검토결과',
    ],
    rows: classified.map((row) => [
      row.date,
      row.card,
      row.department,
      row.user,
      row.merchant,
      row.category,
      row.amount,
      row.receipt,
      row.limit,
      '',
    ]),
    oracle: buildOracle(classified),
  };
}
```

The fixed rows must make only eight rows exceptional. For each duplicate pair, count one later row as 중복 의심 and keep the earlier row normal in buildOracle so normalCount remains 28.

- [ ] **Step 4: Run the dataset test and verify GREEN**

Run: npx vitest run scripts/tests/excel-demo-data.test.js

Expected: 1 test passed.

- [ ] **Step 5: Commit**

```powershell
git add scripts/addin-performance/excel-demo-data.mjs scripts/tests/excel-demo-data.test.js
git commit -m "test(excel-addin): add deterministic expense demo data"
```

---

### Task 2: Polished Workbook with Blank Automation Targets

**Files:**

- Create: scripts/addin-performance/generate-excel-demo-workbook.mjs
- Create: scripts/tests/excel-demo-workbook.test.js
- Output: artifacts/addin-demo/2026-07-20/excel/법인카드-자동점검-시연.xlsx

**Interfaces:**

- Consumes: buildExpenseDemoData().
- Produces: buildExcelDemoWorkbook(outputPath) returning { outputPath, oracle, snapshot }.
- Produces: snapshot with worksheet names, used ranges, and source values for the WSS harness.

- [ ] **Step 1: Write the failing workbook contract test**

```js
it('exports a source sheet and blank formula-driven result shell', async () => {
  const result = await buildExcelDemoWorkbook(outputPath);
  expect(result.snapshot.sheets['원천자료'].values).toHaveLength(37);
  expect(result.snapshot.sheets['자동화결과'].values[2][1]).toBe('');
  expect(result.snapshot.sheets['자동화결과'].values[8][0]).toBe('부서');
  expect(result.oracle.exceptionCount).toBe(8);
  expect((await stat(outputPath)).size).toBeGreaterThan(10_000);
});
```

- [ ] **Step 2: Run the workbook test and verify RED**

Run: npx vitest run scripts/tests/excel-demo-workbook.test.js

Expected: FAIL because buildExcelDemoWorkbook is missing.

- [ ] **Step 3: Build the workbook with artifact-tool**

Use the bundled runtime paths returned by load_workspace_dependencies. Create a scratch node_modules junction to the bundled node_modules and import only public artifact-tool APIs.

The workbook builder must:

```js
const workbook = Workbook.create();
const source = workbook.worksheets.add('원천자료');
const dashboard = workbook.worksheets.add('자동화결과');

source.getRange('A1:J37').values = [demo.headers, ...demo.rows];
source.freezePanes.freezeRows(1);
source.getRange('A1:J1').format = {
  fill: '#003B70',
  font: { bold: true, color: '#FFFFFF' },
};
source.getRange('A2:A37').format.numberFormat = 'yyyy-mm-dd';
source.getRange('G2:G37').format.numberFormat = '#,##0';
source.getRange('I2:I37').format.numberFormat = '#,##0';
source.getRange('J2:J37').conditionalFormats.add('containsText', {
  text: '정상',
  format: { fill: '#E2F0D9', font: { color: '#276221' } },
});
source
  .getRange('J2:J37')
  .conditionalFormats.addCustom('=AND($J2<>"",$J2<>"정상")', {
    format: { fill: '#FCE4D6', font: { color: '#C00000', bold: true } },
  });

dashboard.showGridLines = false;
dashboard.getRange('A1:H1').merge();
dashboard.getRange('A1').values = [['법인카드 자동 점검 결과']];
dashboard.getRange('A3:A6').values = [
  ['총 사용액'],
  ['정상 건수'],
  ['예외 건수'],
  ['예외 금액'],
];
dashboard.getRange('B3:B6').values = [[''], [''], [''], ['']];
dashboard.getRange('A9:C13').values = [
  ['부서', '사용액', '예외 건수'],
  ['디지털혁신부', '', ''],
  ['영업기획부', '', ''],
  ['고객지원부', '', ''],
  ['경영지원부', '', ''],
];

const chart = dashboard.charts.add('bar', dashboard.getRange('A9:B13'));
chart.title = '부서별 법인카드 사용액';
chart.hasLegend = false;
chart.yAxis = { numberFormatCode: '#,##0' };
chart.setPosition('E3', 'L16');
```

Apply explicit widths, compact borders, KPI fills, and Korean number formats. Export with SpreadsheetFile.exportXlsx and write a JSON snapshot beside the workbook. Do not write formulas into J2:J37, B3:B6, or B10:C13.

- [ ] **Step 4: Inspect and render every sheet**

Use workbook.inspect for 원천자료!A1:J37 and 자동화결과!A1:L16. Scan for formula errors. Render both sheets to PNG and inspect them individually. Fix clipped headers, unreadable chart labels, oversized columns, or a blank/overlapping chart.

Expected: the source sheet visibly contains 36 rows; the dashboard shows empty KPI/summary cells and a reserved chart without layout defects.

- [ ] **Step 5: Run the workbook test and verify GREEN**

Run: npx vitest run scripts/tests/excel-demo-workbook.test.js

Expected: all workbook contract tests pass.

- [ ] **Step 6: Commit**

```powershell
git add scripts/addin-performance/generate-excel-demo-workbook.mjs scripts/tests/excel-demo-workbook.test.js
git commit -m "feat(excel-addin): build visual automation demo workbook"
```

---

### Task 3: Seeded Excel Benchmark Harness

**Files:**

- Modify: scripts/addin-performance/run-sidecar-benchmark.mjs
- Modify: scripts/tests/sidecar-benchmark.test.js
- Create: artifacts/addin-demo/2026-07-20/excel/prompt.txt

**Interfaces:**

- Consumes: snapshot JSON from Task 2 through --excel-fixture.
- Produces: ExcelHarness read_range responses from the seeded workbook.
- Produces: excel-operations.json grouped by run and representing only operations chosen by GLM.

- [ ] **Step 1: Add failing harness tests**

```js
it('reads seeded source values and tracks formula writes', () => {
  const harness = new ExcelHarness({
    sheets: {
      원천자료: {
        values: [
          ['거래일', '금액'],
          ['2026-07-01', 1000],
        ],
      },
      자동화결과: { values: [['제목'], ['']] },
    },
    activeSheet: '원천자료',
  });
  expect(
    harness.execute('read_range', {
      sheet: '원천자료',
      range: 'A1:B2',
    }).values,
  ).toEqual([
    ['거래일', '금액'],
    ['2026-07-01', 1000],
  ]);
  harness.execute('set_formulas', {
    sheet: '자동화결과',
    range: 'A2',
    formulas: [['=SUM(원천자료!B2:B2)']],
  });
  expect(harness.operations.at(-1).op).toBe('set_formulas');
});
```

- [ ] **Step 2: Run the harness test and verify RED**

Run: npx vitest run scripts/tests/sidecar-benchmark.test.js

Expected: FAIL because ExcelHarness ignores constructor seed data.

- [ ] **Step 3: Implement seeded range storage**

Add A1 parsing helpers and retain both values and formulas per sheet. get_workbook_overview must report seeded used ranges. read_range must slice the requested rectangle. write_range, set_formulas, clear_range, and add_worksheet must mutate the in-memory grid after recording the operation.

Before every cold or warm user turn, reset the harness grid to the original seed so all four runs start from the same blank-result workbook. Record operations under the active run as { runIndex, operations }; do not aggregate four turns into one replay list.

Add CLI parsing:

```js
const excelFixture = args['excel-fixture']
  ? JSON.parse(await fs.readFile(path.resolve(args['excel-fixture']), 'utf8'))
  : undefined;

const excelHarness = new ExcelHarness(options.excelFixture);
```

Reject --excel-fixture for PowerPoint and retain the current empty workbook behavior when omitted.

- [ ] **Step 4: Add the 50-second demo prompt**

The exact prompt file must contain:

```text
원천자료 36건을 자동 점검하고 자동화결과 시트를 완성하세요.
검토결과에는 정상·영수증 누락·한도 초과·중복 의심 수식을 한 번에 입력하세요.
중복 의심은 현재 행까지 같은 날짜·사용자·가맹점·금액이 두 번째 이상일 때만 표시하고,
총 사용액·정상/예외 건수·예외 금액과 부서별 사용액/예외 건수를 수식으로 채우세요.
기존 차트와 양식은 유지하고 필요한 셀만 서식 적용한 뒤, 완료라고만 답하세요.
```

- [ ] **Step 5: Run tests and verify GREEN**

Run: npx vitest run scripts/tests/sidecar-benchmark.test.js scripts/tests/excel-demo-data.test.js scripts/tests/excel-demo-workbook.test.js

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add scripts/addin-performance/run-sidecar-benchmark.mjs scripts/tests/sidecar-benchmark.test.js
git commit -m "test(excel-addin): seed demo workbook benchmark state"
```

---

### Task 4: Replay GLM Operations Through Real Excel

**Files:**

- Create: scripts/addin-performance/replay-excel-demo-operations.ps1
- Create: scripts/tests/excel-demo-replay.test.js

**Interfaces:**

- Consumes: base workbook, excel-operations.json, and oracle JSON.
- Produces: excel-demo-final.xlsx and office-com-verification.json.
- Reuses: the safe fixed operation dispatch pattern in replay-excel-operations.ps1.

- [ ] **Step 1: Write failing validation and COM tests**

The tests must reject an unsupported operation before opening Excel and, on Windows with Excel installed, replay a fixed minimal operation list into a temporary copy and reopen it.

```js
expect(result.verification).toMatchObject({
  reopened: true,
  rows: 36,
  exceptionCount: 8,
  chartCount: 1,
  formulaErrors: 0,
});
```

- [ ] **Step 2: Run and verify RED**

Run: npx vitest run scripts/tests/excel-demo-replay.test.js

Expected: FAIL because the replay script does not exist.

- [ ] **Step 3: Implement the safe PowerShell replay**

Open the base workbook through Excel.Application, dispatch only:

```powershell
switch ($operation.op) {
  'read_range'    { }
  'get_workbook_overview' { }
  'write_range'   { Invoke-WriteRange $operation.args }
  'set_formulas'  { Invoke-SetFormulas $operation.args }
  'format_range'  { Invoke-FormatRange $operation.args }
  'clear_range'   { Invoke-ClearRange $operation.args }
  'add_worksheet' { Invoke-AddWorksheet $operation.args }
  'find'          { }
  'get_selection' { }
  default         { throw "UNSUPPORTED_OPERATION:$($operation.op)" }
}
```

Save to a distinct output path, close Excel, reopen read-only, and validate:

- 원천자료 used rows = 37 including header.
- 검토결과 formulas exist in J2:J37.
- 자동화결과 B3:B6 and B10:C13 contain formulas and values matching the oracle.
- one chart exists and its source values are nonblank.
- no #REF!, #DIV/0!, #VALUE!, #NAME?, or #N/A values exist.

Always close workbooks and quit Excel in finally blocks.

- [ ] **Step 4: Run tests and verify GREEN**

Run: npx vitest run scripts/tests/excel-demo-replay.test.js

Expected: validation-only and actual Excel COM tests pass.

- [ ] **Step 5: Commit**

```powershell
git add scripts/addin-performance/replay-excel-demo-operations.ps1 scripts/tests/excel-demo-replay.test.js
git commit -m "test(excel-addin): verify demo through real Excel"
```

---

### Task 5: GLM Timing, Visual QA, and Handoff

**Files:**

- Modify: packages/excel-addin/README.md
- Create: artifacts/addin-demo/2026-07-20/excel/README.md
- Create: artifacts/addin-demo/2026-07-20/excel/metrics.json

**Interfaces:**

- Consumes: installed Excel sidecar, prompt, snapshot, base workbook, oracle.
- Produces: cold 1 / warm 3 timings, actual final workbook, renders, hashes, and demo instructions.

- [ ] **Step 1: Build and install the Excel Add-in**

Run:

```powershell
npm test
npm run typecheck
npm run build
```

Expected: 52 existing tests plus new tests pass, both TypeScript projects typecheck, and ES5 gate passes. Install the updated dist while retaining bundled node.exe and cli/cli.js.

- [ ] **Step 2: Run GLM cold 1 / warm 3**

Run run-sidecar-benchmark.mjs with:

- --app excel
- --runs 4
- --timeout 50000 per run or a 205000 ms total watchdog
- --excel-fixture pointing to the workbook snapshot
- the exact prompt from Task 3

Expected: every run has sendToCompleteMs below 50,000, no error frame, and contains the required set_formulas operations.

- [ ] **Step 3: Replay and visually inspect the final workbook**

Replay the median valid warm run operation list through Excel COM. Render both worksheets with artifact-tool, inspect them individually, and confirm:

- all 36 results visible;
- exception rows visually distinguishable;
- KPI values match oracle;
- department chart is populated and readable;
- no clipping or formula errors.

- [ ] **Step 4: Document the demo script and model limitation**

README must state:

- open 법인카드-자동점검-시연.xlsx;
- show the populated 원천자료 and empty 자동화결과;
- paste the short prompt and start the stopwatch on Send;
- switch to 자동화결과 when tool activity starts;
- stop when 완료 appears;
- local timing is GLM evidence, not Qwen3.6 35B evidence;
- rerun once in the Qwen environment before the live event.

- [ ] **Step 5: Commit code and docs, retain generated artifacts untracked**

```powershell
git add packages/excel-addin/README.md
git commit -m "docs(excel-addin): document 50-second automation demo"
```

Do not commit generated XLSX, PNG, raw frames, or offline ZIP files; retain them under artifacts/addin-demo/2026-07-20/excel.
