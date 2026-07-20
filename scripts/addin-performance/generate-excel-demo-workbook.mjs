import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';
import { buildExpenseDemoData } from './excel-demo-data.mjs';

const SOURCE_SHEET = '원천자료';
const DASHBOARD_SHEET = '자동화결과';
const SOURCE_RANGE = 'A1:J37';
const DASHBOARD_RANGE = 'A1:L16';

function normalizeMatrix(matrix) {
  return matrix.map((row) => row.map((value) => value ?? ''));
}

function inspectSheet(sheet) {
  const usedRange = sheet.getUsedRange().address;
  const range = sheet.getRange(usedRange);
  return {
    usedRange,
    values: normalizeMatrix(range.values),
    formulas: normalizeMatrix(range.formulas),
  };
}

async function makeSnapshot(workbook) {
  const source = workbook.worksheets.getItem(SOURCE_SHEET);
  const dashboard = workbook.worksheets.getItem(DASHBOARD_SHEET);
  const drawingInspection = await workbook.inspect({
    kind: 'drawing',
    sheetId: DASHBOARD_SHEET,
  });
  const drawings = drawingInspection.ndjson
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map(({ drawingType, anchor }) => ({ drawingType, anchor }));

  return {
    worksheetNames: [
      workbook.worksheets.getItemAt(0).name,
      workbook.worksheets.getItemAt(1).name,
    ],
    sheets: {
      [SOURCE_SHEET]: inspectSheet(source),
      [DASHBOARD_SHEET]: {
        ...inspectSheet(dashboard),
        charts: dashboard.charts.items.map((chart) => ({
          type: chart.type,
          title: chart.title?.text ?? '',
          series: chart.series.items.map((series) => ({
            name: series.name,
            formula: series.formula,
            categoryFormula: series.categoryFormula,
          })),
        })),
        drawings,
      },
    },
  };
}

function resolveOutputPaths(outputPath) {
  if (
    typeof outputPath !== 'string' ||
    path.extname(outputPath).toLowerCase() !== '.xlsx'
  ) {
    throw new Error('Excel demo workbook output path must end with .xlsx');
  }
  const resolvedOutputPath = path.resolve(outputPath);
  return {
    resolvedOutputPath,
    snapshotPath: `${resolvedOutputPath.slice(0, -'.xlsx'.length)}.snapshot.json`,
  };
}

function styleSourceSheet(source) {
  source.showGridLines = false;
  source.freezePanes.freezeRows(1);
  source.getRange('A1:J1').format = {
    fill: '#003B70',
    font: { bold: true, color: '#FFFFFF', size: 11 },
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    borders: { preset: 'outside', style: 'thin', color: '#003B70' },
    rowHeight: 28,
  };
  source.getRange('A2:J37').format = {
    font: { color: '#263238', size: 10 },
    verticalAlignment: 'center',
    borders: {
      insideHorizontal: { style: 'thin', color: '#E3EAF0' },
      bottom: { style: 'thin', color: '#BCC9D4' },
    },
    rowHeight: 21,
  };
  source.getRange('A2:A37').format.numberFormat = 'yyyy-mm-dd';
  source.getRange('G2:G37').format.numberFormat = '#,##0';
  source.getRange('I2:I37').format.numberFormat = '#,##0';
  source.getRange('G2:G37').format.horizontalAlignment = 'right';
  source.getRange('I2:I37').format.horizontalAlignment = 'right';
  source.getRange('H2:H37').format.horizontalAlignment = 'center';
  source.getRange('J2:J37').format.horizontalAlignment = 'center';

  const widths = {
    A: 13,
    B: 17,
    C: 18,
    D: 11,
    E: 23,
    F: 13,
    G: 13,
    H: 11,
    I: 13,
    J: 16,
  };
  for (const [column, width] of Object.entries(widths)) {
    source.getRange(`${column}1:${column}37`).format.columnWidth = width;
  }

  source.getRange('J2:J37').conditionalFormats.add('containsText', {
    text: '정상',
    format: { fill: '#E2F0D9', font: { color: '#276221' } },
  });
  source
    .getRange('J2:J37')
    .conditionalFormats.addCustom('=AND($J2<>"",$J2<>"정상")', {
      format: { fill: '#FCE4D6', font: { color: '#C00000', bold: true } },
    });
}

function styleDashboardSheet(dashboard) {
  dashboard.showGridLines = false;
  dashboard.getRange('A1:H1').merge();
  dashboard.getRange('A1').values = [['법인카드 자동 점검 결과']];
  dashboard.getRange('A1:H1').format = {
    fill: '#003B70',
    font: { bold: true, color: '#FFFFFF', size: 20 },
    horizontalAlignment: 'left',
    verticalAlignment: 'center',
    rowHeight: 38,
  };

  dashboard.getRange('A3:A6').values = [
    ['총 사용액'],
    ['정상 건수'],
    ['예외 건수'],
    ['예외 금액'],
  ];
  dashboard.getRange('B3:B6').values = [[''], [''], [''], ['']];
  dashboard.getRange('A3:A6').format = {
    fill: '#D9EAF7',
    font: { bold: true, color: '#003B70', size: 11 },
    verticalAlignment: 'center',
    borders: { preset: 'all', style: 'thin', color: '#AFC7D9' },
    rowHeight: 27,
  };
  dashboard.getRange('B3:B6').format = {
    fill: '#F4F8FB',
    font: { bold: true, color: '#003B70', size: 12 },
    horizontalAlignment: 'right',
    verticalAlignment: 'center',
    borders: { preset: 'all', style: 'thin', color: '#AFC7D9' },
  };
  dashboard.getRange('B3').format.numberFormat = '#,##0"원"';
  dashboard.getRange('B4:B5').format.numberFormat = '#,##0"건"';
  dashboard.getRange('B6').format.numberFormat = '#,##0"원"';

  dashboard.getRange('A9:C13').values = [
    ['부서', '사용액', '예외 건수'],
    ['프로덕트운영팀', '', ''],
    ['영업기획부', '', ''],
    ['고객지원팀', '', ''],
    ['경영지원팀', '', ''],
  ];
  dashboard.getRange('A9:C9').format = {
    fill: '#003B70',
    font: { bold: true, color: '#FFFFFF', size: 10 },
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    borders: { preset: 'all', style: 'thin', color: '#003B70' },
    rowHeight: 25,
  };
  dashboard.getRange('A10:C13').format = {
    font: { color: '#263238', size: 10 },
    verticalAlignment: 'center',
    borders: {
      insideHorizontal: { style: 'thin', color: '#D8E1E8' },
      bottom: { style: 'thin', color: '#AFC0CC' },
    },
    rowHeight: 23,
  };
  dashboard.getRange('B10:B13').format.numberFormat = '#,##0"원"';
  dashboard.getRange('C10:C13').format.numberFormat = '#,##0"건"';
  dashboard.getRange('B10:C13').format.horizontalAlignment = 'right';

  dashboard.getRange('A1:A16').format.columnWidth = 19;
  dashboard.getRange('B1:B16').format.columnWidth = 16;
  dashboard.getRange('C1:C16').format.columnWidth = 14;
  dashboard.getRange('D1:D16').format.columnWidth = 3;
  dashboard.getRange('E1:L16').format.columnWidth = 11;

  const chart = dashboard.charts.add('bar', dashboard.getRange('A9:B13'));
  chart.title = '부서별 법인카드 사용액';
  chart.titleTextStyle.fontSize = 13;
  chart.hasLegend = false;
  chart.xAxis = { axisType: 'textAxis', textStyle: { fontSize: 10 } };
  chart.yAxis = { numberFormatCode: '#,##0' };
  chart.setPosition('E3', 'L16');
}

async function writeQaOutputs(workbook, outputPath) {
  const qaDirectory = path.join(path.dirname(outputPath), 'qa');
  await fs.mkdir(qaDirectory, { recursive: true });
  const sourceInspect = await workbook.inspect({
    kind: 'table',
    range: `${SOURCE_SHEET}!${SOURCE_RANGE}`,
    include: 'values,formulas',
    tableMaxRows: 40,
    tableMaxCols: 10,
    maxChars: 12_000,
  });
  const dashboardInspect = await workbook.inspect({
    kind: 'table',
    range: `${DASHBOARD_SHEET}!${DASHBOARD_RANGE}`,
    include: 'values,formulas',
    tableMaxRows: 20,
    tableMaxCols: 12,
    maxChars: 8_000,
  });
  const formulaErrors = await workbook.inspect({
    kind: 'match',
    searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
    options: { useRegex: true, maxResults: 300 },
    summary: 'final formula error scan',
  });
  await fs.writeFile(
    path.join(qaDirectory, 'inspect.ndjson'),
    [sourceInspect.ndjson, dashboardInspect.ndjson, formulaErrors.ndjson].join(
      '\n',
    ),
    'utf8',
  );

  for (const [sheetName, fileName, range] of [
    [SOURCE_SHEET, '원천자료.png', SOURCE_RANGE],
    [DASHBOARD_SHEET, '자동화결과.png', DASHBOARD_RANGE],
  ]) {
    const preview = await workbook.render({
      sheetName,
      range,
      scale: 1.5,
      format: 'png',
    });
    await fs.writeFile(
      path.join(qaDirectory, fileName),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
}

export async function buildExcelDemoWorkbook(outputPath, options = {}) {
  const { resolvedOutputPath, snapshotPath } = resolveOutputPaths(outputPath);
  const demo = buildExpenseDemoData();
  const workbook = Workbook.create();
  const source = workbook.worksheets.add(SOURCE_SHEET);
  const dashboard = workbook.worksheets.add(DASHBOARD_SHEET);

  source.getRange(SOURCE_RANGE).values = [demo.headers, ...demo.rows];
  styleSourceSheet(source);
  styleDashboardSheet(dashboard);

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });

  if (options.renderQa === true) {
    await writeQaOutputs(workbook, resolvedOutputPath);
  }

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(resolvedOutputPath);
  const exportedWorkbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(resolvedOutputPath),
  );
  const snapshot = await makeSnapshot(exportedWorkbook);
  await fs.writeFile(
    snapshotPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  );

  return { outputPath: resolvedOutputPath, oracle: demo.oracle, snapshot };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error(
      'Usage: node generate-excel-demo-workbook.mjs <output.xlsx> [--qa]',
    );
  }
  const result = await buildExcelDemoWorkbook(outputPath, {
    renderQa: process.argv.includes('--qa'),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
