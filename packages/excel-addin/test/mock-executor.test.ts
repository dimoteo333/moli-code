import { describe, expect, it } from 'vitest';
import { createMockExecutor } from '../src/taskpane/mock-executor.js';

describe('mock excel_set_formulas fillDown', () => {
  it('fills the explicit target and adjusts relative row references', async () => {
    const executor = createMockExecutor();
    await executor.exec('set_formulas', {
      range: 'C2:C4',
      formulas: [['=A2+$B2+C$1+$D$1']],
      fillDown: true,
    });
    await expect(
      executor.exec('read_range', { range: 'C2:C4' }),
    ).resolves.toMatchObject({
      formulas: [
        ['=A2+$B2+C$1+$D$1'],
        ['=A3+$B3+C$1+$D$1'],
        ['=A4+$B4+C$1+$D$1'],
      ],
    });
  });

  it('preserves quoted sheet and external reference prefixes', async () => {
    const executor = createMockExecutor();
    const formula =
      "=\"A1\"+'Q1 Data'!B2+'[Budget 2026.xlsx]Q1'!C$3+$D4+[Book1.xlsx]Sheet1!E2";
    await executor.exec('set_formulas', {
      range: 'A2:A3',
      formulas: [[formula]],
      fillDown: true,
    });
    await expect(
      executor.exec('read_range', { range: 'A2:A3' }),
    ).resolves.toMatchObject({
      formulas: [
        [formula],
        [
          "=\"A1\"+'Q1 Data'!B3+'[Budget 2026.xlsx]Q1'!C$3+$D5+[Book1.xlsx]Sheet1!E3",
        ],
      ],
    });
  });

  it('preserves function names ending in digits', async () => {
    const executor = createMockExecutor();
    await executor.exec('set_formulas', {
      range: 'A2:A3',
      formulas: [['=LOG10(B2)+LOG10   (C2)']],
      fillDown: true,
    });
    await expect(
      executor.exec('read_range', { range: 'A2:A3' }),
    ).resolves.toMatchObject({
      formulas: [['=LOG10(B2)+LOG10   (C2)'], ['=LOG10(B3)+LOG10   (C3)']],
    });
  });

  it('rejects invalid dimensions before writing any cell', async () => {
    const executor = createMockExecutor();
    await expect(
      executor.exec('set_formulas', {
        range: 'C2:D4',
        formulas: [['=A2']],
        fillDown: true,
      }),
    ).rejects.toThrow('column count');
    await expect(
      executor.exec('read_range', { range: 'C2:D4' }),
    ).resolves.toMatchObject({
      formulas: [
        ['', ''],
        ['', ''],
        ['', ''],
      ],
    });
  });
});
