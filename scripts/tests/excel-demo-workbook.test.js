import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildExcelDemoWorkbook } from '../addin-performance/generate-excel-demo-workbook.mjs';

describe('buildExcelDemoWorkbook', () => {
  let tempDirectory;

  afterEach(async () => {
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true });
      tempDirectory = undefined;
    }
  });

  it('exports a source sheet and blank formula-driven result shell', async () => {
    tempDirectory = await mkdtemp(path.join(tmpdir(), 'moli-excel-demo-'));
    const outputPath = path.join(tempDirectory, '법인카드-자동점검-시연.xlsx');

    const result = await buildExcelDemoWorkbook(outputPath);

    expect(result.outputPath).toBe(outputPath);
    expect(result.snapshot.worksheetNames).toEqual(['원천자료', '자동화결과']);
    expect(result.snapshot.sheets['원천자료'].usedRange).toBe('A1:J37');
    expect(result.snapshot.sheets['원천자료'].values).toHaveLength(37);
    expect(result.snapshot.sheets['자동화결과'].usedRange).toBe('A1:L16');
    expect(result.snapshot.sheets['자동화결과'].values[2][1]).toBe('');
    expect(result.snapshot.sheets['자동화결과'].values[8][0]).toBe('부서');
    expect(result.snapshot.sheets['자동화결과'].formulas[2][1]).toBe('');
    expect(result.snapshot.sheets['자동화결과'].formulas[9][1]).toBe('');
    expect(result.snapshot.sheets['자동화결과'].formulas[9][2]).toBe('');
    expect(
      result.snapshot.sheets['원천자료'].formulas
        .slice(1)
        .every((row) => row[9] === ''),
    ).toBe(true);
    expect(result.oracle.exceptionCount).toBe(8);
    expect((await stat(outputPath)).size).toBeGreaterThan(10_000);

    const snapshotPath = outputPath.replace(/\.xlsx$/i, '.snapshot.json');
    expect(JSON.parse(await readFile(snapshotPath, 'utf8'))).toEqual(
      result.snapshot,
    );
  });
});
