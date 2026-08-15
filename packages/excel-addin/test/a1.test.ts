import { describe, expect, it } from 'vitest';
import {
  colToLetter,
  letterToCol,
  parseRange,
  formatRange,
  cellAddress,
  shiftFormulaRows,
} from '../src/taskpane/a1.js';

describe('a1 helpers', () => {
  it('converts columns to letters and back', () => {
    expect(colToLetter(1)).toBe('A');
    expect(colToLetter(26)).toBe('Z');
    expect(colToLetter(27)).toBe('AA');
    expect(colToLetter(703)).toBe('AAA');
    expect(letterToCol('A')).toBe(1);
    expect(letterToCol('Z')).toBe(26);
    expect(letterToCol('AA')).toBe(27);
    expect(letterToCol('AAA')).toBe(703);
  });

  it('parses plain ranges', () => {
    expect(parseRange('A1:C10')).toEqual({
      sheet: null,
      startCol: 1,
      startRow: 1,
      endCol: 3,
      endRow: 10,
    });
  });

  it('parses single cells and sheet-qualified refs', () => {
    expect(parseRange('B2')).toMatchObject({
      startCol: 2,
      startRow: 2,
      endCol: 2,
      endRow: 2,
    });
    expect(parseRange("'My Sheet'!D4:E5")).toMatchObject({
      sheet: 'My Sheet',
      startCol: 4,
    });
    expect(parseRange('Sheet1!$A$1:$B$2')).toMatchObject({
      sheet: 'Sheet1',
      endCol: 2,
      endRow: 2,
    });
  });

  it('normalizes reversed ranges', () => {
    expect(parseRange('C10:A1')).toMatchObject({
      startCol: 1,
      startRow: 1,
      endCol: 3,
      endRow: 10,
    });
  });

  it('rejects garbage', () => {
    expect(parseRange('nope!')).toBeNull();
    expect(parseRange('1A')).toBeNull();
  });

  it('formats ranges and cell addresses', () => {
    expect(
      formatRange({ startCol: 1, startRow: 1, endCol: 3, endRow: 10 }),
    ).toBe('A1:C10');
    expect(
      formatRange({ startCol: 2, startRow: 2, endCol: 2, endRow: 2 }),
    ).toBe('B2');
    expect(cellAddress(28, 5)).toBe('AB5');
  });

  it('does not rewrite function names ending in digits', () => {
    expect(shiftFormulaRows('=LOG10(A2)+LOG10   (B2)', 1)).toBe(
      '=LOG10(A3)+LOG10   (B3)',
    );
  });
});
