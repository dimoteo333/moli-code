/**
 * Deterministic fixtures and metric helpers for Office Add-in benchmarks.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ARTIFACT_ROOT = path.resolve(
  'artifacts',
  'addin-performance',
  '2026-07-20',
);

const CATEGORIES = ['사용료', '수수료', '이자수입', '기타수입'];
const METHODS = ['계좌이체', '자동이체', '카드', '현금'];
const WEEK_RANGES = [
  { label: '1주차', fromDay: 1, toDay: 5 },
  { label: '2주차', fromDay: 6, toDay: 12 },
  { label: '3주차', fromDay: 13, toDay: 19 },
  { label: '4주차', fromDay: 20, toDay: 26 },
  { label: '5주차', fromDay: 27, toDay: 31 },
];

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function julyDate(day) {
  return `2026-07-${String(day).padStart(2, '0')}`;
}

export function generateReceipts(seed = 20260719) {
  const random = createRandom(seed);
  const rows = [];
  let sequence = 0;

  for (let day = 1; day <= 31; day += 1) {
    const dailyCount = 1 + Math.floor(random() * 3);
    for (let dailySequence = 1; dailySequence <= dailyCount; dailySequence += 1) {
      sequence += 1;
      const category = CATEGORIES[Math.floor(random() * CATEGORIES.length)];
      const amount = (50 + Math.floor(random() * 451)) * 1000;
      rows.push({
        receiptId: `R-202607-${String(sequence).padStart(4, '0')}`,
        date: julyDate(day),
        payer: `테스트수납처-${String(day).padStart(2, '0')}-${dailySequence}`,
        category,
        amount,
        method: METHODS[(sequence - 1) % METHODS.length],
        note: '성능 검증용 고정 시드 자료',
      });
    }
  }

  const weeks = WEEK_RANGES.map(({ label, fromDay, toDay }) => ({
    label,
    from: julyDate(fromDay),
    to: julyDate(toDay),
    total: rows
      .filter((row) => {
        const day = Number(row.date.slice(-2));
        return day >= fromDay && day <= toDay;
      })
      .reduce((sum, row) => sum + row.amount, 0),
  }));

  return {
    schemaVersion: 1,
    seed,
    period: { from: julyDate(1), to: julyDate(31) },
    weekDefinition: 'ISO Monday-Sunday, clipped to July 2026',
    rows,
    weeks,
    monthTotal: rows.reduce((sum, row) => sum + row.amount, 0),
  };
}

export function buildExcelReplayPlan(operations, fixture) {
  const allowedOps = new Set([
    'get_workbook_overview',
    'read_range',
    'write_range',
    'set_formulas',
    'get_selection',
    'clear_range',
    'add_worksheet',
    'format_range',
    'find',
  ]);
  if (!Array.isArray(operations) || !operations.length) {
    throw new Error('Excel operation log is empty');
  }
  for (const operation of operations) {
    if (!operation || !allowedOps.has(operation.op)) {
      throw new Error(`Unsupported Excel operation: ${String(operation?.op)}`);
    }
    if (!operation.args || typeof operation.args !== 'object') {
      throw new Error(`Excel operation '${operation.op}' has invalid args`);
    }
  }

  const writes = operations.filter((operation) => operation.op === 'write_range');
  const lastWrite = (predicate) => [...writes].reverse().find(predicate);
  const raw = lastWrite(
    (operation) =>
      operation.args.sheet === '수납원장' &&
      Array.isArray(operation.args.values) &&
      operation.args.values.length === fixture.rows.length + 1,
  );
  const weekly = lastWrite(
    (operation) =>
      operation.args.sheet === '주별집계' &&
      String(operation.args.range).startsWith('A1:') &&
      Array.isArray(operation.args.values) &&
      operation.args.values.length >= fixture.weeks.length + 1,
  );
  const monthly = lastWrite(
    (operation) =>
      operation.args.sheet === '월별집계' &&
      Array.isArray(operation.args.values) &&
      operation.args.values.length >= 2,
  );
  if (!raw || !weekly || !monthly) {
    throw new Error('Recorded operations do not contain all required Excel tables');
  }

  const expectedRows = fixture.rows.map((row) => [
    row.receiptId,
    row.date,
    row.payer,
    row.category,
    row.amount,
    row.method,
    row.note,
  ]);
  if (JSON.stringify(raw.args.values.slice(1)) !== JSON.stringify(expectedRows)) {
    throw new Error('Recorded receipt rows do not match the fixture');
  }
  const weeklyTotals = weekly.args.values
    .slice(1, fixture.weeks.length + 1)
    .map((row) => Number(row[3]));
  const expectedWeekly = fixture.weeks.map((week) => week.total);
  if (JSON.stringify(weeklyTotals) !== JSON.stringify(expectedWeekly)) {
    throw new Error('Recorded weekly totals do not match the fixture oracle');
  }
  const monthTotal = Number(monthly.args.values[1][1]);
  if (monthTotal !== fixture.monthTotal) {
    throw new Error('Recorded monthly total does not match the fixture oracle');
  }

  return {
    operationCount: operations.length,
    receiptCount: expectedRows.length,
    weeklyTotals,
    monthTotal,
    operations,
  };
}

export function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function summarizeRun(events) {
  const first = new Map();
  for (const event of events) {
    if (!first.has(event.name) && Number.isFinite(event.atMs)) {
      first.set(event.name, event.atMs);
    }
  }
  const interval = (from, to) => {
    const fromMs = first.get(from);
    const toMs = first.get(to);
    return fromMs === undefined || toMs === undefined ? undefined : toMs - fromMs;
  };
  return {
    paneToReadyMs: interval('taskpane_connected', 'cli_initialized'),
    sendToApiMs: interval('user_message_sent', 'api_request_started'),
    apiToFirstDeltaMs: interval('api_request_started', 'first_delta_received'),
    sendToFirstDeltaMs: interval('user_message_sent', 'first_delta_received'),
    sendToArtifactMs: interval('user_message_sent', 'artifact_saved'),
    sendToCompleteMs: interval('user_message_sent', 'turn_completed'),
  };
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function writeTextWithHash(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  await writeFile(`${filePath}.sha256`, `${sha256(content)}  ${path.basename(filePath)}\n`, 'utf8');
}

export async function writeJsonWithHash(filePath, value) {
  await writeTextWithHash(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
