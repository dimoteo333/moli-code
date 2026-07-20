import { execFile } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const bundledNodeModules =
  process.env.CODEX_BUNDLED_NODE_MODULES ??
  path.join(
    homedir(),
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'node',
    'node_modules',
  );
const bundledNode =
  process.env.CODEX_BUNDLED_NODE ??
  path.join(
    path.dirname(bundledNodeModules),
    'bin',
    process.platform === 'win32' ? 'node.exe' : 'node',
  );

const verifierSource = `
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

function normalize(matrix) {
  return matrix.map((row) => row.map((value) => value ?? ''));
}

const input = await FileBlob.load(process.argv[2]);
const workbook = await SpreadsheetFile.importXlsx(input);
const source = workbook.worksheets.getItem('원천자료');
const dashboard = workbook.worksheets.getItem('자동화결과');
const drawingInspection = await workbook.inspect({ kind: 'drawing', sheetId: '자동화결과' });
const drawings = drawingInspection.ndjson
  .split(/\\r?\\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .map(({ drawingType, anchor }) => ({ drawingType, anchor }));

function inspectSheet(sheet) {
  const usedRange = sheet.getUsedRange().address;
  const range = sheet.getRange(usedRange);
  return {
    usedRange,
    values: normalize(range.values),
    formulas: normalize(range.formulas),
  };
}

const snapshot = {
  worksheetNames: [
    workbook.worksheets.getItemAt(0).name,
    workbook.worksheets.getItemAt(1).name,
  ],
  sheets: {
    원천자료: inspectSheet(source),
    자동화결과: {
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

process.stdout.write(JSON.stringify(snapshot));
`;

describe('buildExcelDemoWorkbook', () => {
  let scratchDirectory;
  let builderPath;

  beforeEach(async () => {
    const scratchRoot = path.join(
      tmpdir(),
      'codex-spreadsheets',
      'qwen36-office-demo-excel',
    );
    await Promise.all([access(bundledNode), access(bundledNodeModules)]);
    await mkdir(scratchRoot, { recursive: true });
    scratchDirectory = await mkdtemp(path.join(scratchRoot, 'test-'));
    const scriptDirectory = path.join(
      scratchDirectory,
      'scripts',
      'addin-performance',
    );
    await mkdir(scriptDirectory, { recursive: true });
    await symlink(
      bundledNodeModules,
      path.join(scratchDirectory, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    builderPath = path.join(
      scriptDirectory,
      'generate-excel-demo-workbook.mjs',
    );
    await Promise.all([
      copyFile(
        path.join(
          repositoryRoot,
          'scripts',
          'addin-performance',
          'generate-excel-demo-workbook.mjs',
        ),
        builderPath,
      ),
      copyFile(
        path.join(
          repositoryRoot,
          'scripts',
          'addin-performance',
          'excel-demo-data.mjs',
        ),
        path.join(scriptDirectory, 'excel-demo-data.mjs'),
      ),
      writeFile(
        path.join(scratchDirectory, 'verify-export.mjs'),
        verifierSource,
        'utf8',
      ),
    ]);
  });

  afterEach(async () => {
    if (scratchDirectory) {
      await rm(scratchDirectory, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
      scratchDirectory = undefined;
    }
  });

  async function runBuilder(outputPath) {
    const { stdout } = await execFileAsync(
      bundledNode,
      [builderPath, outputPath],
      {
        cwd: scratchDirectory,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
    );
    const resultLine = stdout
      .trim()
      .split(/\r?\n/)
      .findLast((line) => line.startsWith('{'));
    return JSON.parse(resultLine);
  }

  async function inspectExport(outputPath) {
    const { stdout } = await execFileAsync(
      bundledNode,
      [path.join(scratchDirectory, 'verify-export.mjs'), outputPath],
      { cwd: scratchDirectory, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
    );
    return JSON.parse(stdout);
  }

  it('exports a source sheet and blank formula-driven result shell', async () => {
    const outputPath = path.join(
      scratchDirectory,
      '법인카드-자동점검-시연.xlsx',
    );

    const result = await runBuilder(outputPath);
    const actual = await inspectExport(outputPath);

    expect(result.outputPath).toBe(outputPath);
    expect(result.snapshot).toEqual(actual);
    expect(result.snapshot.worksheetNames).toEqual(['원천자료', '자동화결과']);
    expect(result.snapshot.sheets['원천자료'].usedRange).toBe('A1:J37');
    expect(result.snapshot.sheets['원천자료'].values).toHaveLength(37);
    expect(
      result.snapshot.sheets['원천자료'].values
        .slice(1)
        .every((row) => row[9] === ''),
    ).toBe(true);
    expect(
      result.snapshot.sheets['원천자료'].formulas
        .slice(1)
        .every((row) => row[9] === ''),
    ).toBe(true);
    expect(result.snapshot.sheets['자동화결과'].usedRange).toBe('A1:H13');
    expect(result.snapshot.sheets['자동화결과'].values[2][1]).toBe('');
    expect(result.snapshot.sheets['자동화결과'].values[8][0]).toBe('부서');
    expect(result.snapshot.sheets['자동화결과'].formulas[2][1]).toBe('');
    expect(result.snapshot.sheets['자동화결과'].formulas[9][1]).toBe('');
    expect(result.snapshot.sheets['자동화결과'].formulas[9][2]).toBe('');
    expect(result.snapshot.sheets['자동화결과'].charts).toEqual([
      {
        type: 'bar',
        title: '부서별 법인카드 사용액',
        series: [
          {
            name: '사용액',
            formula: "'자동화결과'!$B$10:$B$13",
            categoryFormula: "'자동화결과'!$A$10:$A$13",
          },
        ],
      },
    ]);
    expect(result.snapshot.sheets['자동화결과'].drawings).toEqual([
      {
        drawingType: 'chart',
        anchor: {
          from: expect.objectContaining({ row: 2, col: 4 }),
          to: expect.objectContaining({ row: 16, col: 12 }),
        },
      },
    ]);
    expect(result.oracle.exceptionCount).toBe(8);
    expect((await stat(outputPath)).size).toBeGreaterThan(10_000);

    const snapshotPath = outputPath.replace(/\.xlsx$/i, '.snapshot.json');
    expect(JSON.parse(await readFile(snapshotPath, 'utf8'))).toEqual(actual);
  }, 30_000);

  it('rejects a non-xlsx output path without writing either output file', async () => {
    const outputPath = path.join(scratchDirectory, 'unsafe-output.json');

    await expect(runBuilder(outputPath)).rejects.toThrow(/\.xlsx/i);
    await expect(access(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      access(path.join(scratchDirectory, 'unsafe-output.snapshot.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  }, 30_000);
});
