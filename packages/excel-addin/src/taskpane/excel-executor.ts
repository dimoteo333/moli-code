/**
 * Executes `excel_exec` ops from the sidecar against the open workbook via
 * Office.js `Excel.run()`. Legacy operations are available in ExcelApi 1.1;
 * optional formula fillDown uses ExcelApi 1.9. ES5-only: promise chains,
 * no async/await.
 */

import type { ExcelOp } from '../shared/messages.js';
import { parseRange, formatRange, cellAddress } from './a1.js';

export interface ExcelExecutor {
  exec(op: ExcelOp, args: { [key: string]: unknown }): Promise<unknown>;
}

const MAX_CELLS = 10000;
const MAX_FIND_RESULTS = 100;

interface RangeArgs {
  sheet?: string;
  range?: string;
}

function getSheet(ctx: Excel.RequestContext, args: RangeArgs): Excel.Worksheet {
  return args.sheet
    ? ctx.workbook.worksheets.getItem(args.sheet)
    : ctx.workbook.worksheets.getActiveWorksheet();
}

function requireRange(args: RangeArgs): string {
  if (!args.range) {
    throw new Error("'range' argument is required");
  }
  return args.range;
}

/**
 * If `range` is a single cell but the 2D array is larger, expand the range
 * to match the array dimensions (agents often say "write starting at A1").
 */
function expandRangeForArray(
  range: string,
  rows: number,
  cols: number,
): string {
  const parsed = parseRange(range);
  if (!parsed) {
    return range;
  }
  const isSingleCell =
    parsed.startCol === parsed.endCol && parsed.startRow === parsed.endRow;
  if (isSingleCell && (rows > 1 || cols > 1)) {
    return formatRange({
      startCol: parsed.startCol,
      startRow: parsed.startRow,
      endCol: parsed.startCol + cols - 1,
      endRow: parsed.startRow + rows - 1,
    });
  }
  return range;
}

function validate2dArray(value: unknown, what: string): unknown[][] {
  if (
    !value ||
    Object.prototype.toString.call(value) !== '[object Array]' ||
    (value as unknown[]).length === 0 ||
    Object.prototype.toString.call((value as unknown[])[0]) !== '[object Array]'
  ) {
    throw new Error(
      "'" + what + "' must be a non-empty 2D array (array of rows)",
    );
  }
  return value as unknown[][];
}

export function createOfficeExecutor(
  options: { supportsFillDown?: boolean } = {},
): ExcelExecutor {
  return {
    exec(op: ExcelOp, args: { [key: string]: unknown }): Promise<unknown> {
      switch (op) {
        case 'get_workbook_overview':
          return getWorkbookOverview();
        case 'read_range':
          return readRange(args);
        case 'write_range':
          return writeRange(args);
        case 'set_formulas':
          return setFormulas(args, options.supportsFillDown === true);
        case 'get_selection':
          return getSelection();
        case 'clear_range':
          return clearRange(args);
        case 'add_worksheet':
          return addWorksheet(args);
        case 'format_range':
          return formatRangeOp(args);
        case 'find':
          return findOp(args);
        default:
          return Promise.reject(new Error('Unknown Excel op: ' + op));
      }
    },
  };
}

function getWorkbookOverview(): Promise<unknown> {
  const sheetNames: string[] = [];
  let activeSheet = '';
  let selection = '';
  return Excel.run((ctx) => {
    const sheets = ctx.workbook.worksheets;
    sheets.load('items/name');
    const active = ctx.workbook.worksheets.getActiveWorksheet();
    active.load('name');
    const sel = ctx.workbook.getSelectedRange();
    sel.load('address');
    return ctx.sync().then(() => {
      for (let i = 0; i < sheets.items.length; i++) {
        sheetNames.push(sheets.items[i].name);
      }
      activeSheet = active.name;
      selection = sel.address;
    });
  }).then(() => {
    // Used ranges probed one sheet at a time: an empty sheet throws
    // ItemNotFound and would poison a combined batch.
    const results: Array<{
      name: string;
      usedRange: string | null;
      rows: number;
      cols: number;
    }> = [];
    let chain = Promise.resolve();
    const makeStep = function (name: string) {
      return function () {
        return Excel.run((ctx) => {
          const used = ctx.workbook.worksheets.getItem(name).getUsedRange();
          used.load('address,rowCount,columnCount');
          return ctx.sync().then(() => {
            results.push({
              name,
              usedRange: used.address,
              rows: used.rowCount,
              cols: used.columnCount,
            });
          });
        }).then(undefined, () => {
          results.push({ name, usedRange: null, rows: 0, cols: 0 });
        });
      };
    };
    for (let i = 0; i < sheetNames.length; i++) {
      chain = chain.then(makeStep(sheetNames[i]));
    }
    return chain.then(() => ({
      sheets: results,
      activeSheet,
      selection,
    }));
  });
}

function readRange(args: RangeArgs): Promise<unknown> {
  const rangeRef = requireRange(args);
  return Excel.run((ctx) => {
    const range = getSheet(ctx, args).getRange(rangeRef);
    range.load('address,rowCount,columnCount');
    return ctx.sync().then(() => {
      const rows = range.rowCount;
      const cols = range.columnCount;
      let truncated = false;
      let readRef = range.address;
      if (rows * cols > MAX_CELLS) {
        truncated = true;
        const keepRows = Math.max(1, Math.floor(MAX_CELLS / cols));
        const parsed = parseRange(range.address);
        if (!parsed) {
          throw new Error('Range too large to read: ' + range.address);
        }
        readRef = formatRange({
          startCol: parsed.startCol,
          startRow: parsed.startRow,
          endCol: parsed.endCol,
          endRow: parsed.startRow + keepRows - 1,
        });
      }
      const subRange = getSheet(ctx, args).getRange(readRef);
      subRange.load('address,values,formulas,numberFormat');
      return ctx.sync().then(() => {
        const result: { [key: string]: unknown } = {
          address: subRange.address,
          totalRows: rows,
          totalCols: cols,
          values: subRange.values,
          formulas: subRange.formulas,
          numberFormat: subRange.numberFormat,
        };
        if (truncated) {
          result['truncated'] =
            'Range has ' +
            rows * cols +
            ' cells; only the first rows are returned. Read smaller chunks for the rest.';
        }
        return result;
      });
    });
  });
}

function writeRange(args: RangeArgs & { values?: unknown }): Promise<unknown> {
  const values = validate2dArray(args.values, 'values');
  const rangeRef = expandRangeForArray(
    requireRange(args),
    values.length,
    (values[0] as unknown[]).length,
  );
  return Excel.run((ctx) => {
    const range = getSheet(ctx, args).getRange(rangeRef);
    range.values = values as Array<Array<string | number | boolean>>;
    range.load('address');
    return ctx.sync().then(() => ({
      written: range.address,
      rows: values.length,
      cols: (values[0] as unknown[]).length,
    }));
  });
}

function setFormulas(
  args: RangeArgs & { formulas?: unknown; fillDown?: unknown },
  supportsFillDown: boolean,
): Promise<unknown> {
  const formulas = validate2dArray(args.formulas, 'formulas');
  if (args.fillDown === true) {
    if (!supportsFillDown) {
      throw new Error(
        "'fillDown' requires ExcelApi 1.9; omit fillDown and provide the full 2D formula array on this host",
      );
    }
    const requestedRange = requireRange(args);
    const parsed = parseRange(requestedRange);
    if (!parsed || parsed.endRow <= parsed.startRow) {
      throw new Error("'fillDown' requires an explicit multi-row target range");
    }
    if (formulas.length !== 1) {
      throw new Error("'fillDown' formulas must contain exactly one row");
    }
    const targetColumnCount = parsed.endCol - parsed.startCol + 1;
    if ((formulas[0] as unknown[]).length !== targetColumnCount) {
      throw new Error(
        "'fillDown' formula column count must match the target range column count",
      );
    }
    return Excel.run((ctx) => {
      const range = getSheet(ctx, args).getRange(requestedRange);
      const firstRow = range.getRow(0);
      firstRow.formulas = formulas as string[][];
      firstRow.autoFill(range, 'FillDefault');
      range.load('address');
      return ctx.sync().then(() => ({
        written: range.address,
        fillDown: true,
        rows: parsed.endRow - parsed.startRow + 1,
        cols: targetColumnCount,
      }));
    });
  }
  const rangeRef = expandRangeForArray(
    requireRange(args),
    formulas.length,
    (formulas[0] as unknown[]).length,
  );
  return Excel.run((ctx) => {
    const range = getSheet(ctx, args).getRange(rangeRef);
    range.formulas = formulas as string[][];
    range.load('address');
    return ctx.sync().then(() => ({ written: range.address }));
  });
}

function getSelection(): Promise<unknown> {
  return Excel.run((ctx) => {
    const sel = ctx.workbook.getSelectedRange();
    sel.load('address,rowCount,columnCount');
    return ctx.sync().then((): Promise<unknown> | unknown => {
      if (sel.rowCount * sel.columnCount > MAX_CELLS) {
        return {
          address: sel.address,
          note: 'Selection too large; values omitted.',
        };
      }
      sel.load('values,formulas');
      return ctx.sync().then(() => ({
        address: sel.address,
        values: sel.values,
        formulas: sel.formulas,
      }));
    });
  });
}

function clearRange(args: RangeArgs & { applyTo?: string }): Promise<unknown> {
  const rangeRef = requireRange(args);
  const applyTo =
    args.applyTo === 'formats'
      ? 'Formats'
      : args.applyTo === 'all'
        ? 'All'
        : 'Contents';
  return Excel.run((ctx) => {
    const range = getSheet(ctx, args).getRange(rangeRef);
    range.clear(applyTo as Excel.ClearApplyTo);
    range.load('address');
    return ctx.sync().then(() => ({ cleared: range.address, applyTo }));
  });
}

function addWorksheet(args: { name?: unknown }): Promise<unknown> {
  const name = String(args.name || '');
  if (!name) {
    return Promise.reject(new Error("'name' argument is required"));
  }
  return Excel.run((ctx) => {
    const sheet = ctx.workbook.worksheets.add(name);
    sheet.activate();
    sheet.load('name');
    return ctx.sync().then(() => ({ added: sheet.name }));
  });
}

function formatRangeOp(
  args: RangeArgs & {
    numberFormat?: string;
    bold?: boolean;
    fillColor?: string;
    fontColor?: string;
  },
): Promise<unknown> {
  const rangeRef = requireRange(args);
  return Excel.run((ctx) => {
    const range = getSheet(ctx, args).getRange(rangeRef);
    if (typeof args.numberFormat === 'string') {
      // Office.js broadcasts a scalar to the whole range.
      (range as unknown as { numberFormat: unknown }).numberFormat =
        args.numberFormat;
    }
    if (typeof args.bold === 'boolean') {
      range.format.font.bold = args.bold;
    }
    if (typeof args.fillColor === 'string') {
      range.format.fill.color = args.fillColor;
    }
    if (typeof args.fontColor === 'string') {
      range.format.font.color = args.fontColor;
    }
    range.load('address');
    return ctx.sync().then(() => ({ formatted: range.address }));
  });
}

function findOp(args: { query?: unknown; sheet?: string }): Promise<unknown> {
  const query = String(args.query || '').toLowerCase();
  if (!query) {
    return Promise.reject(new Error("'query' argument is required"));
  }
  return Excel.run((ctx) => {
    const sheet = getSheet(ctx, args);
    const used = sheet.getUsedRange();
    used.load('address,values,rowCount,columnCount');
    return ctx.sync().then(() => {
      if (used.rowCount * used.columnCount > 200000) {
        throw new Error('Used range too large to scan: ' + used.address);
      }
      const origin = parseRange(used.address);
      const matches: Array<{ address: string; value: unknown }> = [];
      for (
        let r = 0;
        r < used.values.length && matches.length < MAX_FIND_RESULTS;
        r++
      ) {
        for (
          let c = 0;
          c < used.values[r].length && matches.length < MAX_FIND_RESULTS;
          c++
        ) {
          const cell = used.values[r][c];
          if (
            cell !== null &&
            cell !== '' &&
            String(cell).toLowerCase().indexOf(query) >= 0
          ) {
            matches.push({
              address: origin
                ? cellAddress(origin.startCol + c, origin.startRow + r)
                : '?',
              value: cell,
            });
          }
        }
      }
      return { matches, count: matches.length, scanned: used.address };
    });
  }).then(undefined, (err: unknown) => {
    // Empty sheet → no used range → no matches.
    if (err && (err as { code?: string }).code === 'ItemNotFound') {
      return { matches: [], count: 0, scanned: null };
    }
    throw err;
  });
}
