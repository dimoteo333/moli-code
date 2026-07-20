/**
 * Drives the installed task-pane protocol without claiming to be Office UI.
 */

import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import {
  median,
  summarizeRun,
  writeJsonWithHash,
  writeTextWithHash,
} from './lib.mjs';

const PROTOCOL_VERSION = 1;

function columnToNumber(column) {
  let value = 0;
  for (const char of column.toUpperCase()) {
    value = value * 26 + char.charCodeAt(0) - 64;
  }
  return value;
}

function numberToColumn(value) {
  let column = '';
  let current = value;
  while (current > 0) {
    current -= 1;
    column = String.fromCharCode(65 + (current % 26)) + column;
    current = Math.floor(current / 26);
  }
  return column;
}

function expandedRange(range, rows, cols) {
  const single = /^([A-Za-z]+)(\d+)$/.exec(range);
  if (!single || (rows === 1 && cols === 1)) {
    return range;
  }
  const startColumn = columnToNumber(single[1]);
  const startRow = Number(single[2]);
  return `${single[1].toUpperCase()}${startRow}:${numberToColumn(startColumn + cols - 1)}${startRow + rows - 1}`;
}

function parseRange(range) {
  const match = /^\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/.exec(
    range,
  );
  if (!match) {
    throw new Error(`Unsupported Excel range: ${range}`);
  }
  const startRow = Number(match[2]) - 1;
  const startCol = columnToNumber(match[1]) - 1;
  const endRow = match[4] ? Number(match[4]) - 1 : startRow;
  const endCol = match[3] ? columnToNumber(match[3]) - 1 : startCol;
  if (endRow < startRow || endCol < startCol) {
    throw new Error(`Unsupported Excel range: ${range}`);
  }
  return { startRow, startCol, endRow, endCol };
}

function cloneMatrix(matrix = []) {
  return Array.isArray(matrix)
    ? matrix.map((row) => (Array.isArray(row) ? [...row] : []))
    : [];
}

function sheetDimensions(sheet) {
  const matrices = [sheet.values, sheet.formulas];
  const rows = Math.max(0, ...matrices.map((matrix) => matrix.length));
  const cols = Math.max(
    0,
    ...matrices.flatMap((matrix) =>
      matrix.map((row) => (Array.isArray(row) ? row.length : 0)),
    ),
  );
  return { rows, cols };
}

function usedRangeForSheet(sheet) {
  if (sheet.usedRange) {
    const bounds = parseRange(sheet.usedRange);
    return {
      usedRange: sheet.usedRange,
      rows: bounds.endRow - bounds.startRow + 1,
      cols: bounds.endCol - bounds.startCol + 1,
    };
  }
  const { rows, cols } = sheetDimensions(sheet);
  return {
    usedRange:
      rows > 0 && cols > 0 ? `A1:${numberToColumn(cols)}${rows}` : null,
    rows,
    cols,
  };
}

function makeSheet(source = {}) {
  return {
    values: cloneMatrix(source.values),
    formulas: cloneMatrix(source.formulas),
    usedRange:
      typeof source.usedRange === 'string' ? source.usedRange : undefined,
  };
}

function ensureCell(matrix, row, col) {
  while (matrix.length <= row) {
    matrix.push([]);
  }
  while (matrix[row].length <= col) {
    matrix[row].push('');
  }
}

function writeMatrix(
  sheet,
  property,
  startRow,
  startCol,
  input,
  clearOtherProperty = false,
) {
  for (let rowOffset = 0; rowOffset < input.length; rowOffset += 1) {
    const inputRow = Array.isArray(input[rowOffset]) ? input[rowOffset] : [];
    for (let colOffset = 0; colOffset < inputRow.length; colOffset += 1) {
      const row = startRow + rowOffset;
      const col = startCol + colOffset;
      ensureCell(sheet[property], row, col);
      sheet[property][row][col] = inputRow[colOffset];
      if (clearOtherProperty) {
        const otherProperty = property === 'values' ? 'formulas' : 'values';
        ensureCell(sheet[otherProperty], row, col);
        sheet[otherProperty][row][col] = '';
      }
    }
  }
}

function expandUsedRange(sheet, endRow, endCol) {
  const current = usedRangeForSheet(sheet);
  const rows = Math.max(current.rows, endRow + 1);
  const cols = Math.max(current.cols, endCol + 1);
  sheet.usedRange =
    rows > 0 && cols > 0 ? `A1:${numberToColumn(cols)}${rows}` : undefined;
}

export class ExcelHarness {
  constructor(seed) {
    const fallbackSeed = {
      sheets: { Sheet1: {} },
      activeSheet: 'Sheet1',
    };
    this.seed = structuredClone(seed ?? fallbackSeed);
    this.operations = [];
    this.runOperations = [];
    this.reset();
  }

  reset() {
    const sheetEntries = Object.entries(this.seed.sheets ?? {});
    if (sheetEntries.length === 0) {
      sheetEntries.push(['Sheet1', {}]);
    }
    this.sheets = new Map(
      sheetEntries.map(([name, sheet]) => [name, makeSheet(sheet)]),
    );
    this.activeSheet =
      this.seed.activeSheet && this.sheets.has(this.seed.activeSheet)
        ? this.seed.activeSheet
        : sheetEntries[0][0];
  }

  startRun(runIndex, kind) {
    this.reset();
    const run = { runIndex, kind, operations: [] };
    this.runOperations.push(run);
    this.operations = run.operations;
  }

  getSheet(name) {
    const sheet = this.sheets.get(name);
    if (!sheet) {
      throw new Error(`Worksheet not found: ${name}`);
    }
    return sheet;
  }

  execute(op, args = {}) {
    this.operations.push({ op, args });
    const sheetName =
      typeof args.sheet === 'string' ? args.sheet : this.activeSheet;
    switch (op) {
      case 'get_workbook_overview':
        return {
          sheets: [...this.sheets].map(([name, sheet]) => ({
            name,
            ...usedRangeForSheet(sheet),
          })),
          activeSheet: this.activeSheet,
          selection: `${this.activeSheet}!A1`,
        };
      case 'add_worksheet': {
        const name = String(args.name ?? '');
        if (!name.trim()) {
          throw new Error("'name' argument is required");
        }
        if (
          [...this.sheets.keys()].some(
            (existing) => existing.toLowerCase() === name.toLowerCase(),
          )
        ) {
          throw new Error(`Worksheet already exists: ${name}`);
        }
        this.sheets.set(name, makeSheet());
        this.activeSheet = name;
        return { added: name };
      }
      case 'write_range': {
        const values = Array.isArray(args.values) ? args.values : [];
        const rows = values.length;
        const cols = Array.isArray(values[0]) ? values[0].length : 0;
        const range = expandedRange(String(args.range ?? 'A1'), rows, cols);
        const bounds = parseRange(range);
        const sheet = this.getSheet(sheetName);
        writeMatrix(
          sheet,
          'values',
          bounds.startRow,
          bounds.startCol,
          values,
          true,
        );
        expandUsedRange(sheet, bounds.endRow, bounds.endCol);
        return { written: `${sheetName}!${range}`, rows, cols };
      }
      case 'set_formulas': {
        const formulas = Array.isArray(args.formulas) ? args.formulas : [];
        const rows = formulas.length;
        const cols = Array.isArray(formulas[0]) ? formulas[0].length : 0;
        const range = expandedRange(String(args.range ?? 'A1'), rows, cols);
        const bounds = parseRange(range);
        const sheet = this.getSheet(sheetName);
        writeMatrix(
          sheet,
          'formulas',
          bounds.startRow,
          bounds.startCol,
          formulas,
          true,
        );
        expandUsedRange(sheet, bounds.endRow, bounds.endCol);
        return { written: `${sheetName}!${range}` };
      }
      case 'format_range':
        return { formatted: `${sheetName}!${String(args.range ?? 'A1')}` };
      case 'clear_range': {
        const range = String(args.range ?? 'A1');
        const bounds = parseRange(range);
        const sheet = this.getSheet(sheetName);
        const applyTo =
          args.applyTo === 'formats'
            ? 'Formats'
            : args.applyTo === 'all'
              ? 'All'
              : 'Contents';
        if (applyTo !== 'Formats') {
          for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
            for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
              ensureCell(sheet.values, row, col);
              ensureCell(sheet.formulas, row, col);
              sheet.values[row][col] = '';
              sheet.formulas[row][col] = '';
            }
          }
        }
        return { cleared: `${sheetName}!${range}`, applyTo };
      }
      case 'read_range':
      case 'get_selection': {
        const range = String(args.range ?? 'A1');
        const bounds = parseRange(range);
        const sheet = this.getSheet(sheetName);
        const values = [];
        const formulas = [];
        const numberFormat = [];
        for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
          const valueRow = [];
          const formulaRow = [];
          const formatRow = [];
          for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
            valueRow.push(sheet.values[row]?.[col] ?? '');
            formulaRow.push(sheet.formulas[row]?.[col] ?? '');
            formatRow.push('General');
          }
          values.push(valueRow);
          formulas.push(formulaRow);
          numberFormat.push(formatRow);
        }
        return {
          address: `${sheetName}!${range}`,
          totalRows: bounds.endRow - bounds.startRow + 1,
          totalCols: bounds.endCol - bounds.startCol + 1,
          values,
          formulas,
          numberFormat,
        };
      }
      case 'find': {
        const query = String(args.query ?? '').toLowerCase();
        if (!query) {
          throw new Error("'query' argument is required");
        }
        const sheet = this.getSheet(sheetName);
        const used = usedRangeForSheet(sheet);
        if (!used.usedRange) {
          return { matches: [], truncated: false };
        }
        const bounds = parseRange(used.usedRange);
        const matches = [];
        let truncated = false;
        outer: for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
          for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
            const value = sheet.values[row]?.[col] ?? '';
            if (
              value !== null &&
              value !== '' &&
              String(value).toLowerCase().includes(query)
            ) {
              if (matches.length === 100) {
                truncated = true;
                break outer;
              }
              matches.push({
                address: `${numberToColumn(col + 1)}${row + 1}`,
                value,
              });
            }
          }
        }
        return { matches, truncated };
      }
      default:
        throw new Error(`Unsupported Excel harness operation: ${op}`);
    }
  }
}

function metricMedian(runs, key) {
  const values = runs
    .filter((run) => run.kind === 'warm')
    .map((run) => run.summary[key])
    .filter(Number.isFinite);
  return median(values);
}

function connectionInterval(events, from, to) {
  const fromMs = events.find((event) => event.name === from)?.atMs;
  const toMs = events.find((event) => event.name === to)?.atMs;
  return Number.isFinite(fromMs) && Number.isFinite(toMs)
    ? toMs - fromMs
    : undefined;
}

export function buildBenchmarkManifest({
  app,
  stage,
  runs,
  connectionEvents = [],
}) {
  const metricKeys = [
    'paneToReadyMs',
    'sendToApiMs',
    'apiToFirstDeltaMs',
    'sendToFirstDeltaMs',
    'sendToArtifactMs',
    'sendToCompleteMs',
  ];
  return {
    schemaVersion: 1,
    app,
    stage,
    measurementPath: 'full-path-harness',
    createdAt: new Date().toISOString(),
    connection: {
      paneToQuerySpawnMs: connectionInterval(
        connectionEvents,
        'taskpane_connected',
        'query_spawn_started',
      ),
      querySpawnToCliReadyMs: connectionInterval(
        connectionEvents,
        'query_spawn_started',
        'cli_initialized',
      ),
      paneToReadyMs: connectionInterval(
        connectionEvents,
        'taskpane_connected',
        'cli_initialized',
      ),
      paneToHelloOkMs: connectionInterval(
        connectionEvents,
        'taskpane_connected',
        'hello_ok_received',
      ),
      events: connectionEvents,
    },
    unavailableMetrics: [
      {
        name: 'api_request_started',
        reason:
          'Not exposed by the Add-in protocol; SDK/CLI instrumentation is excluded by user scope.',
      },
    ],
    runCount: runs.length,
    warmMedian: Object.fromEntries(
      metricKeys.map((key) => [key, metricMedian(runs, key)]),
    ),
    runs,
  };
}

function getJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        rejectUnauthorized: false,
        timeout: 5000,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `GET ${pathname} failed with ${response.statusCode}: ${body}`,
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(
              new Error(
                `GET ${pathname} returned invalid JSON: ${error.message}`,
              ),
            );
          }
        });
      },
    );
    request.on('timeout', () =>
      request.destroy(new Error(`GET ${pathname} timed out`)),
    );
    request.on('error', reject);
  });
}

function parseArgs(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) {
      throw new Error(`Unexpected argument: ${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${key}`);
    }
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

function sendJson(socket, frame) {
  socket.send(JSON.stringify({ v: PROTOCOL_VERSION, ...frame }));
}

export async function runSidecarBenchmark(options) {
  if (options.app === 'powerpoint' && options.excelFixture) {
    throw new Error('--excel-fixture is only supported for Excel benchmarks');
  }
  const tokenBody = await getJson(options.port, '/token');
  if (typeof tokenBody.token !== 'string') {
    throw new Error('Sidecar /token response did not contain a token');
  }

  const prompt = await fs.readFile(options.promptPath, 'utf8');
  let attachment;
  let excelPrompt = prompt;
  if (options.attachmentPath) {
    const content = await fs.readFile(options.attachmentPath, 'utf8');
    if (options.app === 'powerpoint') {
      attachment = {
        name: path.basename(options.attachmentPath),
        content,
        size: Buffer.byteLength(content, 'utf8'),
        mimeType: 'text/markdown',
      };
    } else {
      excelPrompt = `${prompt}\n\n<benchmark_input_json>\n${content}\n</benchmark_input_json>\n`;
    }
  }

  const excelHarness = new ExcelHarness(options.excelFixture);
  const rawFrames = [];
  const connectionEvents = [];
  const runs = [];
  const startedAt = performance.now();
  let activeRun = null;
  let nextRunIndex = 0;

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`wss://localhost:${options.port}/ws`, {
      rejectUnauthorized: false,
    });
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`Benchmark timed out after ${options.timeoutMs}ms`));
    }, options.timeoutMs);

    const now = () => Math.round((performance.now() - startedAt) * 1000) / 1000;
    const mark = (name, fields = {}) => {
      if (activeRun) {
        activeRun.events.push({ name, atMs: now(), ...fields });
      }
    };
    const sendNext = () => {
      if (nextRunIndex >= options.runs) {
        clearTimeout(timeout);
        socket.close();
        resolve();
        return;
      }
      activeRun = {
        index: nextRunIndex + 1,
        kind: nextRunIndex === 0 ? 'cold' : 'warm',
        events: [],
        assistantText: '',
        errors: [],
      };
      runs.push(activeRun);
      if (options.app === 'excel') {
        excelHarness.startRun(activeRun.index, activeRun.kind);
      }
      mark('user_message_sent');
      sendJson(socket, {
        type: 'user_message',
        text: options.app === 'excel' ? excelPrompt : prompt,
        ...(attachment ? { attachments: [attachment] } : {}),
      });
      nextRunIndex += 1;
    };

    socket.on('open', () => {
      const atMs = now();
      rawFrames.push({ direction: 'local', type: 'taskpane_connected', atMs });
      connectionEvents.push({ name: 'taskpane_connected', atMs });
      sendJson(socket, {
        type: 'hello',
        token: tokenBody.token,
        requirementSets:
          options.app === 'excel'
            ? { 'ExcelApi 1.1': true, 'ExcelApi 1.4': true }
            : { 'PowerPointApi 1.1': true },
        host: options.app === 'excel' ? 'Excel' : 'PowerPoint',
        platform: 'PC',
        uiLocale: 'ko-KR',
      });
    });

    socket.on('message', (data) => {
      const frame = JSON.parse(String(data));
      rawFrames.push({ direction: 'sidecar', atMs: now(), frame });
      if (frame.type === 'hello_ok') {
        connectionEvents.push({ name: 'hello_ok_received', atMs: now() });
        sendNext();
        return;
      }
      if (frame.type === 'assistant_delta' && activeRun) {
        if (
          !activeRun.events.some(
            (event) => event.name === 'first_delta_received',
          )
        ) {
          mark('first_delta_received');
        }
        activeRun.assistantText += frame.text ?? '';
        return;
      }
      if (frame.type === 'assistant_message' && activeRun) {
        for (const block of frame.blocks ?? []) {
          if (block.type === 'text' && typeof block.text === 'string') {
            activeRun.assistantText += block.text;
          }
        }
        return;
      }
      if (frame.type === 'tool_activity') {
        mark(
          frame.status === 'start'
            ? 'office_tool_started'
            : 'office_tool_finished',
          {
            toolName: frame.toolName,
            isError: frame.isError === true,
          },
        );
        return;
      }
      if (frame.type === 'permission_request') {
        sendJson(socket, {
          type: 'permission_response',
          id: frame.id,
          behavior: 'allow',
          alwaysAllow: true,
        });
        return;
      }
      if (frame.type === 'excel_exec') {
        try {
          const result = excelHarness.execute(frame.op, frame.args);
          sendJson(socket, {
            type: 'excel_result',
            id: frame.id,
            ok: true,
            result,
          });
        } catch (error) {
          sendJson(socket, {
            type: 'excel_result',
            id: frame.id,
            ok: false,
            error: error.message,
            errorCode: 'HARNESS_OPERATION_FAILED',
          });
        }
        return;
      }
      if (frame.type === 'error' && activeRun) {
        activeRun.errors.push({ code: frame.code, message: frame.messageKo });
        return;
      }
      if (frame.type === 'performance_event') {
        const event = {
          name: frame.name,
          atMs: now(),
          sidecarElapsedMs: frame.elapsedMs,
          ...(frame.turnId === undefined ? {} : { turnId: frame.turnId }),
          ...(frame.detail === undefined ? {} : { detail: frame.detail }),
        };
        if (activeRun) {
          activeRun.events.push(event);
        } else {
          connectionEvents.push(event);
        }
        return;
      }
      if (frame.type === 'turn_complete' && activeRun) {
        mark('turn_completed', { isError: frame.isError === true });
        activeRun.isError = frame.isError === true;
        activeRun.errorMessage = frame.errorMessage;
        activeRun.summary = summarizeRun(activeRun.events);
        activeRun = null;
        setTimeout(sendNext, 100);
      }
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  const manifest = buildBenchmarkManifest({
    app: options.app,
    stage: options.stage,
    runs,
    connectionEvents,
  });
  await writeJsonWithHash(
    path.join(options.outputDir, 'metrics.json'),
    manifest,
  );
  await writeJsonWithHash(
    path.join(options.outputDir, 'raw-frames.json'),
    rawFrames,
  );
  if (options.app === 'excel') {
    await writeJsonWithHash(
      path.join(options.outputDir, 'excel-operations.json'),
      excelHarness.runOperations,
    );
  }
  await writeTextWithHash(path.join(options.outputDir, 'prompt.txt'), prompt);
  return manifest;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (invokedPath === import.meta.url) {
  const args = parseArgs(process.argv);
  const app = args.app;
  if (app !== 'excel' && app !== 'powerpoint') {
    throw new Error('--app must be excel or powerpoint');
  }
  if (app === 'powerpoint' && args['excel-fixture']) {
    throw new Error('--excel-fixture is only supported for Excel benchmarks');
  }
  const excelFixture = args['excel-fixture']
    ? JSON.parse(await fs.readFile(path.resolve(args['excel-fixture']), 'utf8'))
    : undefined;
  const manifest = await runSidecarBenchmark({
    app,
    stage: args.stage ?? 'stage-00-baseline',
    port: Number(args.port ?? (app === 'excel' ? 39215 : 39216)),
    promptPath: path.resolve(args.prompt),
    attachmentPath: args.attachment ? path.resolve(args.attachment) : undefined,
    outputDir: path.resolve(args.output),
    runs: Number(args.runs ?? 4),
    timeoutMs: Number(args.timeout ?? 600000),
    excelFixture,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        app: manifest.app,
        stage: manifest.stage,
        measurementPath: manifest.measurementPath,
        warmMedian: manifest.warmMedian,
        outputDir: path.resolve(args.output),
      },
      null,
      2,
    )}\n`,
  );
}
