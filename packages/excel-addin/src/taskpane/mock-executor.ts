/**
 * In-memory workbook used with `?mock=1` so the whole pane↔sidecar↔agent
 * loop can be exercised in a plain browser (macOS dev) without Excel.
 */

import type { ExcelOp } from '../shared/messages.js';
import type { ExcelExecutor } from './excel-executor.js';
import { parseRange, formatRange, cellAddress } from './a1.js';

interface MockCell {
  v: string | number | boolean | null;
  f: string;
}

interface MockSheet {
  cells: { [addr: string]: MockCell };
}

function shiftFormulaRows(formula: string, rowOffset: number): string {
  return formula
    .split('"')
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(
            /(^|[^A-Za-z0-9_.])(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)(?![A-Za-z0-9_])/g,
            (_match, prefix, absoluteColumn, column, absoluteRow, row) =>
              prefix +
              absoluteColumn +
              column +
              absoluteRow +
              (absoluteRow ? row : String(Number(row) + rowOffset)),
          ),
    )
    .join('"');
}

export function createMockExecutor(): ExcelExecutor {
  const sheets: { [name: string]: MockSheet } = {
    Sheet1: {
      cells: {
        A1: { v: '항목', f: '' },
        B1: { v: '금액', f: '' },
        A2: { v: '테스트', f: '' },
        B2: { v: 1234, f: '' },
      },
    },
  };
  let activeSheet = 'Sheet1';
  const selection = 'A1:B2';
  // get_selection rotates so multi-attachment flows are testable in mock mode.
  const selectionRotation = ['A1:B2', 'B1:B2', 'A2:B2'];
  let selectionCalls = 0;

  function sheetOf(args: { sheet?: string }): {
    name: string;
    sheet: MockSheet;
  } {
    const name = args.sheet || activeSheet;
    if (!sheets[name]) {
      throw new Error('ItemNotFound: worksheet ' + name);
    }
    return { name, sheet: sheets[name] };
  }

  function usedBounds(
    sheet: MockSheet,
  ): { sc: number; sr: number; ec: number; er: number } | null {
    let found = false;
    let sc = 0;
    let sr = 0;
    let ec = 0;
    let er = 0;
    for (const addr in sheet.cells) {
      if (!Object.prototype.hasOwnProperty.call(sheet.cells, addr)) {
        continue;
      }
      const p = parseRange(addr);
      if (!p) {
        continue;
      }
      if (!found) {
        sc = p.startCol;
        sr = p.startRow;
        ec = p.startCol;
        er = p.startRow;
        found = true;
      } else {
        sc = Math.min(sc, p.startCol);
        sr = Math.min(sr, p.startRow);
        ec = Math.max(ec, p.startCol);
        er = Math.max(er, p.startRow);
      }
    }
    return found ? { sc, sr, ec, er } : null;
  }

  function exec(op: ExcelOp, args: { [key: string]: unknown }): unknown {
    const a = args as {
      sheet?: string;
      range?: string;
      values?: unknown[][];
      formulas?: string[][];
      applyTo?: string;
      name?: string;
      query?: string;
      fillDown?: boolean;
    };
    switch (op) {
      case 'get_workbook_overview': {
        const overview: Array<{
          name: string;
          usedRange: string | null;
          rows: number;
          cols: number;
        }> = [];
        for (const name in sheets) {
          if (!Object.prototype.hasOwnProperty.call(sheets, name)) {
            continue;
          }
          const bounds = usedBounds(sheets[name]);
          overview.push({
            name,
            usedRange: bounds
              ? formatRange({
                  startCol: bounds.sc,
                  startRow: bounds.sr,
                  endCol: bounds.ec,
                  endRow: bounds.er,
                })
              : null,
            rows: bounds ? bounds.er - bounds.sr + 1 : 0,
            cols: bounds ? bounds.ec - bounds.sc + 1 : 0,
          });
        }
        return { sheets: overview, activeSheet, selection };
      }
      case 'read_range': {
        const target = sheetOf(a);
        const p = parseRange(String(a.range));
        if (!p) {
          throw new Error('InvalidArgument: range');
        }
        const values: unknown[][] = [];
        const formulas: string[][] = [];
        for (let r = p.startRow; r <= p.endRow; r++) {
          const vRow: unknown[] = [];
          const fRow: string[] = [];
          for (let c = p.startCol; c <= p.endCol; c++) {
            const cell = target.sheet.cells[cellAddress(c, r)];
            vRow.push(cell ? cell.v : '');
            fRow.push(cell ? cell.f : '');
          }
          values.push(vRow);
          formulas.push(fRow);
        }
        return { address: a.range, values, formulas };
      }
      case 'write_range':
      case 'set_formulas': {
        const t2 = sheetOf(a);
        const grid = (
          op === 'write_range' ? a.values : a.formulas
        ) as unknown[][];
        if (!grid || !grid.length) {
          throw new Error('InvalidArgument: values');
        }
        const p2 = parseRange(String(a.range));
        if (!p2) {
          throw new Error('InvalidArgument: range');
        }
        let rowsToWrite = grid;
        if (op === 'set_formulas' && a.fillDown === true) {
          const targetRows = p2.endRow - p2.startRow + 1;
          const targetCols = p2.endCol - p2.startCol + 1;
          if (targetRows <= 1) {
            throw new Error(
              "'fillDown' requires an explicit multi-row target range",
            );
          }
          if (grid.length !== 1) {
            throw new Error("'fillDown' formulas must contain exactly one row");
          }
          if (grid[0].length !== targetCols) {
            throw new Error(
              "'fillDown' formula column count must match the target range column count",
            );
          }
          rowsToWrite = Array.from({ length: targetRows }, (_, rowOffset) =>
            grid[0].map((formula) =>
              shiftFormulaRows(String(formula), rowOffset),
            ),
          );
        }
        for (let r2 = 0; r2 < rowsToWrite.length; r2++) {
          for (let c2 = 0; c2 < rowsToWrite[r2].length; c2++) {
            const addr = cellAddress(p2.startCol + c2, p2.startRow + r2);
            t2.sheet.cells[addr] =
              op === 'write_range'
                ? { v: rowsToWrite[r2][c2] as MockCell['v'], f: '' }
                : { v: '(계산값)', f: String(rowsToWrite[r2][c2]) };
          }
        }
        return {
          written: a.range,
          rows: rowsToWrite.length,
          cols: rowsToWrite[0].length,
          ...(op === 'set_formulas' && a.fillDown === true
            ? { fillDown: true }
            : {}),
        };
      }
      case 'get_selection':
        // Same shape as the Office executor: address + current cell data.
        return exec('read_range', {
          sheet: activeSheet,
          range: selectionRotation[selectionCalls++ % selectionRotation.length],
        });
      case 'clear_range': {
        const t3 = sheetOf(a);
        const p3 = parseRange(String(a.range));
        if (!p3) {
          throw new Error('InvalidArgument: range');
        }
        for (let r3 = p3.startRow; r3 <= p3.endRow; r3++) {
          for (let c3 = p3.startCol; c3 <= p3.endCol; c3++) {
            delete t3.sheet.cells[cellAddress(c3, r3)];
          }
        }
        return { cleared: a.range, applyTo: a.applyTo || 'contents' };
      }
      case 'add_worksheet': {
        const newName = String(a.name || '');
        if (!newName || sheets[newName]) {
          throw new Error('InvalidArgument: name');
        }
        sheets[newName] = { cells: {} };
        activeSheet = newName;
        return { added: newName };
      }
      case 'format_range':
        return { formatted: a.range };
      case 'find': {
        const t4 = sheetOf(a);
        const q = String(a.query || '').toLowerCase();
        const matches: Array<{ address: string; value: unknown }> = [];
        for (const addr2 in t4.sheet.cells) {
          if (!Object.prototype.hasOwnProperty.call(t4.sheet.cells, addr2)) {
            continue;
          }
          const v = t4.sheet.cells[addr2].v;
          if (v !== null && String(v).toLowerCase().indexOf(q) >= 0) {
            matches.push({ address: addr2, value: v });
          }
        }
        return { matches, count: matches.length };
      }
      default:
        throw new Error('Unknown Excel op: ' + op);
    }
  }

  return {
    exec(op, args) {
      try {
        return Promise.resolve(exec(op, args));
      } catch (err) {
        return Promise.reject(err);
      }
    },
  };
}
