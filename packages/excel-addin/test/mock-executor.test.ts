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
