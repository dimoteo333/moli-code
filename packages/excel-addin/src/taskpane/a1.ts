/**
 * A1-notation helpers (ES5-safe). Used to truncate large ranges and to
 * auto-expand a single-cell target to match a 2D value array.
 */

export interface ParsedRange {
  sheet: string | null;
  startCol: number; // 1-based
  startRow: number; // 1-based
  endCol: number;
  endRow: number;
}

export function colToLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

export function letterToCol(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col;
}

const CELL_RE = /^\$?([A-Za-z]{1,3})\$?([0-9]+)$/;

/** Parse 'Sheet1!A1:C10', 'A1:C10' or 'B2'. Returns null if unsupported. */
export function parseRange(ref: string): ParsedRange | null {
  let sheet: string | null = null;
  let body = ref;
  const bang = ref.lastIndexOf('!');
  if (bang >= 0) {
    sheet = ref.slice(0, bang).replace(/^'/, '').replace(/'$/, '');
    body = ref.slice(bang + 1);
  }
  const parts = body.split(':');
  if (parts.length > 2) {
    return null;
  }
  const start = CELL_RE.exec(parts[0]);
  if (!start) {
    return null;
  }
  const end = parts.length === 2 ? CELL_RE.exec(parts[1]) : start;
  if (!end) {
    return null;
  }
  const startCol = letterToCol(start[1].toUpperCase());
  const startRow = parseInt(start[2], 10);
  const endCol = letterToCol(end[1].toUpperCase());
  const endRow = parseInt(end[2], 10);
  return {
    sheet,
    startCol: Math.min(startCol, endCol),
    startRow: Math.min(startRow, endRow),
    endCol: Math.max(startCol, endCol),
    endRow: Math.max(startRow, endRow),
  };
}

export function formatRange(r: {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}): string {
  const start = colToLetter(r.startCol) + r.startRow;
  const end = colToLetter(r.endCol) + r.endRow;
  return start === end ? start : start + ':' + end;
}

export function cellAddress(col: number, row: number): string {
  return colToLetter(col) + row;
}

/** Shift relative A1 row references while preserving strings and qualifiers. */
export function shiftFormulaRows(formula: string, rowOffset: number): string {
  let result = '';
  let index = 0;
  while (index < formula.length) {
    const current = formula.charAt(index);
    if (current === '"' || current === "'") {
      const quote = current;
      const start = index++;
      while (index < formula.length) {
        if (formula.charAt(index) !== quote) {
          index++;
          continue;
        }
        if (formula.charAt(index + 1) === quote) {
          index += 2;
          continue;
        }
        index++;
        break;
      }
      result += formula.slice(start, index);
      continue;
    }
    if (current === '[') {
      const close = formula.indexOf(']', index + 1);
      if (close >= 0) {
        result += formula.slice(index, close + 1);
        index = close + 1;
        continue;
      }
    }
    const match = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)/.exec(
      formula.slice(index),
    );
    if (match) {
      const previous = index > 0 ? formula.charAt(index - 1) : '';
      const next = formula.charAt(index + match[0].length);
      if (!/[A-Za-z0-9_.]/.test(previous) && !/[A-Za-z0-9_!]/.test(next)) {
        result +=
          match[1] +
          match[2] +
          match[3] +
          (match[3] ? match[4] : String(parseInt(match[4], 10) + rowOffset));
        index += match[0].length;
        continue;
      }
    }
    result += current;
    index++;
  }
  return result;
}
