/**
 * @license
 * Copyright 2026 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import * as helpers from '../addin-performance/lib.mjs';

const execFileAsync = promisify(execFile);

describe('Excel Add-in operation replay evidence', () => {
  it('packages a fixed Excel COM replay script', async () => {
    await expect(
      access('scripts/addin-performance/replay-excel-operations.ps1'),
    ).resolves.toBeUndefined();
    const source = await readFile(
      'scripts/addin-performance/replay-excel-operations.ps1',
      'utf8',
    );
    expect(source).toContain('Excel.Application');
    expect(source).not.toMatch(/Invoke-Expression|\biex\b/i);
  });

  it('enumerates the top-level JSON array in Windows PowerShell 5.1', async () => {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'scripts/addin-performance/replay-excel-operations.ps1',
      '-OperationsPath',
      'artifacts/addin-performance/2026-07-20/stage-00-baseline/excel/excel-operations.json',
      '-FixturePath',
      'artifacts/addin-performance/2026-07-20/fixtures/excel/2026-07-receipts.json',
      '-OutputPath',
      'artifacts/addin-performance/2026-07-20/stage-00-baseline/excel/validation-only.xlsx',
      '-ValidationOnly',
    ]);
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, operationCount: 65 });
  });

  it('replays the recorded operations through installed Excel COM and reopens the workbook', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'moli-excel-replay-'));
    const outputPath = path.join(tempDir, 'replayed.xlsx');
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          'scripts/addin-performance/replay-excel-operations.ps1',
          '-OperationsPath',
          'artifacts/addin-performance/2026-07-20/stage-00-baseline/excel/excel-operations.json',
          '-FixturePath',
          'artifacts/addin-performance/2026-07-20/fixtures/excel/2026-07-receipts.json',
          '-OutputPath',
          outputPath,
        ],
        { timeout: 120_000, windowsHide: true },
      );
      expect(JSON.parse(stdout)).toMatchObject({
        ok: true,
        receiptCount: 63,
        monthTotal: 18417000,
        reopened: true,
      });
      await expect(access(outputPath)).resolves.toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 120_000);

  it('validates the recorded Add-in operations against the fixture oracle', async () => {
    expect(helpers.buildExcelReplayPlan).toBeTypeOf('function');
    const [operations, fixture] = await Promise.all([
      readFile(
        'artifacts/addin-performance/2026-07-20/stage-00-baseline/excel/excel-operations.json',
        'utf8',
      ).then(JSON.parse),
      readFile(
        'artifacts/addin-performance/2026-07-20/fixtures/excel/2026-07-receipts.json',
        'utf8',
      ).then(JSON.parse),
    ]);
    const plan = helpers.buildExcelReplayPlan(operations, fixture);
    expect(plan.operationCount).toBe(65);
    expect(plan.receiptCount).toBe(63);
    expect(plan.weeklyTotals).toEqual([
      3284000, 3470000, 5089000, 4212000, 2362000,
    ]);
    expect(plan.monthTotal).toBe(18417000);
  });
});
