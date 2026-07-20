/**
 * Drives the installed task-pane protocol without claiming to be Office UI.
 */

import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { median, summarizeRun, writeJsonWithHash, writeTextWithHash } from './lib.mjs';

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

export class ExcelHarness {
  constructor() {
    this.operations = [];
    this.sheets = new Set(['Sheet1']);
  }

  execute(op, args = {}) {
    this.operations.push({ op, args });
    const sheet = typeof args.sheet === 'string' ? args.sheet : 'Sheet1';
    switch (op) {
      case 'get_workbook_overview':
        return {
          sheets: [...this.sheets].map((name) => ({
            name,
            usedRange: null,
            rows: 0,
            cols: 0,
          })),
          activeSheet: 'Sheet1',
          selection: 'Sheet1!A1',
        };
      case 'add_worksheet': {
        const name = String(args.name ?? 'Sheet');
        this.sheets.add(name);
        return { added: name };
      }
      case 'write_range': {
        const values = Array.isArray(args.values) ? args.values : [];
        const rows = values.length;
        const cols = Array.isArray(values[0]) ? values[0].length : 0;
        const range = expandedRange(String(args.range ?? 'A1'), rows, cols);
        return { written: `${sheet}!${range}`, rows, cols };
      }
      case 'set_formulas':
        return { written: `${sheet}!${String(args.range ?? 'A1')}` };
      case 'format_range':
        return { formatted: `${sheet}!${String(args.range ?? 'A1')}` };
      case 'clear_range':
        return { cleared: `${sheet}!${String(args.range ?? 'A1')}` };
      case 'read_range':
      case 'get_selection':
        return {
          address: `${sheet}!${String(args.range ?? 'A1')}`,
          totalRows: 1,
          totalCols: 1,
          values: [['']],
          formulas: [['']],
          numberFormat: [['General']],
        };
      case 'find':
        return { matches: [], truncated: false };
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

export function buildBenchmarkManifest({ app, stage, runs }) {
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
    runCount: runs.length,
    warmMedian: Object.fromEntries(metricKeys.map((key) => [key, metricMedian(runs, key)])),
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
            reject(new Error(`GET ${pathname} failed with ${response.statusCode}: ${body}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`GET ${pathname} returned invalid JSON: ${error.message}`));
          }
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error(`GET ${pathname} timed out`)));
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

  const excelHarness = new ExcelHarness();
  const rawFrames = [];
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
      mark('user_message_sent');
      sendJson(socket, {
        type: 'user_message',
        text: options.app === 'excel' ? excelPrompt : prompt,
        ...(attachment ? { attachments: [attachment] } : {}),
      });
      nextRunIndex += 1;
    };

    socket.on('open', () => {
      rawFrames.push({ direction: 'local', type: 'taskpane_connected', atMs: now() });
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
        sendNext();
        return;
      }
      if (frame.type === 'assistant_delta' && activeRun) {
        if (!activeRun.events.some((event) => event.name === 'first_delta_received')) {
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
        mark(frame.status === 'start' ? 'office_tool_started' : 'office_tool_finished', {
          toolName: frame.toolName,
          isError: frame.isError === true,
        });
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
          sendJson(socket, { type: 'excel_result', id: frame.id, ok: true, result });
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
        mark(frame.name, { sidecarElapsedMs: frame.elapsedMs });
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

  const manifest = buildBenchmarkManifest({ app: options.app, stage: options.stage, runs });
  await writeJsonWithHash(path.join(options.outputDir, 'metrics.json'), manifest);
  await writeJsonWithHash(path.join(options.outputDir, 'raw-frames.json'), rawFrames);
  if (options.app === 'excel') {
    await writeJsonWithHash(
      path.join(options.outputDir, 'excel-operations.json'),
      excelHarness.operations,
    );
  }
  await writeTextWithHash(path.join(options.outputDir, 'prompt.txt'), prompt);
  return manifest;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const args = parseArgs(process.argv);
  const app = args.app;
  if (app !== 'excel' && app !== 'powerpoint') {
    throw new Error('--app must be excel or powerpoint');
  }
  const manifest = await runSidecarBenchmark({
    app,
    stage: args.stage ?? 'stage-00-baseline',
    port: Number(args.port ?? (app === 'excel' ? 39215 : 39216)),
    promptPath: path.resolve(args.prompt),
    attachmentPath: args.attachment ? path.resolve(args.attachment) : undefined,
    outputDir: path.resolve(args.output),
    runs: Number(args.runs ?? 4),
    timeoutMs: Number(args.timeout ?? 600000),
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
