/// <reference types="office-js" />

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOfficeExecutor } from '../src/taskpane/excel-executor.js';

function installExcelMock() {
  const autoFill = vi.fn();
  const firstRow = { formulas: [] as string[][], autoFill };
  const range = {
    address: 'Sheet1!A2:A4',
    getRow: vi.fn(() => firstRow),
    load: vi.fn(),
  };
  const sync = vi.fn(() => Promise.resolve());
  const run = vi.fn((callback) =>
    callback({
      workbook: {
        worksheets: {
          getActiveWorksheet: () => ({ getRange: () => range }),
          getItem: () => ({ getRange: () => range }),
        },
      },
      sync,
    }),
  );
  vi.stubGlobal('Excel', { run });
  return { autoFill, firstRow, range, run, sync };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('excel_set_formulas fillDown', () => {
  it('writes one formula row then invokes native fillDown on the target', async () => {
    const mock = installExcelMock();
    const result = await createOfficeExecutor().exec('set_formulas', {
      range: 'A2:A4',
      formulas: [['=B2+$C$1']],
      fillDown: true,
    });

    expect(mock.firstRow.formulas).toEqual([['=B2+$C$1']]);
    expect(mock.autoFill).toHaveBeenCalledWith(mock.range, 'FillDefault');
    expect(result).toMatchObject({ written: 'Sheet1!A2:A4', fillDown: true });
  });

  it.each([
    [{ range: 'A2', formulas: [['=B2']], fillDown: true }, 'multi-row'],
    [{ range: 'A2:B4', formulas: [['=C2']], fillDown: true }, 'column count'],
    [
      { range: 'A2:A4', formulas: [['=B2'], ['=B3']], fillDown: true },
      'exactly one row',
    ],
  ])(
    'rejects invalid fillDown arguments before Excel.run',
    async (args, text) => {
      const mock = installExcelMock();
      await expect(
        Promise.resolve().then(() =>
          createOfficeExecutor().exec('set_formulas', args),
        ),
      ).rejects.toThrow(text);
      expect(mock.run).not.toHaveBeenCalled();
    },
  );
});
