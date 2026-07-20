/**
 * @license
 * Copyright 2026 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  ExcelHarness,
  buildBenchmarkManifest,
} from '../addin-performance/run-sidecar-benchmark.mjs';

describe('ExcelHarness', () => {
  it('reads seeded source values and tracks formula writes', () => {
    const harness = new ExcelHarness({
      sheets: {
        원천자료: {
          values: [
            ['거래일', '금액'],
            ['2026-07-01', 1000],
          ],
        },
        자동화결과: { values: [['제목'], ['']] },
      },
      activeSheet: '원천자료',
    });

    expect(
      harness.execute('read_range', {
        sheet: '원천자료',
        range: 'A1:B2',
      }).values,
    ).toEqual([
      ['거래일', '금액'],
      ['2026-07-01', 1000],
    ]);
    harness.execute('set_formulas', {
      sheet: '자동화결과',
      range: 'A2',
      formulas: [['=SUM(원천자료!B2:B2)']],
    });
    expect(harness.operations.at(-1).op).toBe('set_formulas');
    expect(
      harness.execute('read_range', { sheet: '자동화결과', range: 'A2' })
        .formulas,
    ).toEqual([['=SUM(원천자료!B2:B2)']]);
  });

  it('fills a one-row formula seed down an explicit multi-row range', () => {
    const harness = new ExcelHarness({
      sheets: { Sheet1: {} },
      activeSheet: 'Sheet1',
    });
    harness.execute('set_formulas', {
      range: 'C2:D4',
      formulas: [['=A2+$B2', '=C$1+$D$1']],
      fillDown: true,
    });
    expect(harness.execute('read_range', { range: 'C2:D4' }).formulas).toEqual([
      ['=A2+$B2', '=C$1+$D$1'],
      ['=A3+$B3', '=C$1+$D$1'],
      ['=A4+$B4', '=C$1+$D$1'],
    ]);
  });

  it('preserves quoted sheet and external prefixes while filling formulas', () => {
    const harness = new ExcelHarness({
      sheets: { Sheet1: {} },
      activeSheet: 'Sheet1',
    });
    const formula =
      "=\"A1\"+'Q1 Data'!B2+'[Budget 2026.xlsx]Q1'!C$3+$D4+[Book1.xlsx]Sheet1!E2";
    harness.execute('set_formulas', {
      range: 'A2:A3',
      formulas: [[formula]],
      fillDown: true,
    });
    expect(harness.execute('read_range', { range: 'A2:A3' }).formulas).toEqual([
      [formula],
      [
        "=\"A1\"+'Q1 Data'!B3+'[Budget 2026.xlsx]Q1'!C$3+$D5+[Book1.xlsx]Sheet1!E3",
      ],
    ]);
  });

  it('rejects invalid fillDown dimensions without mutating the seed', () => {
    const harness = new ExcelHarness({
      sheets: { Sheet1: { values: [['kept']] } },
      activeSheet: 'Sheet1',
    });
    expect(() =>
      harness.execute('set_formulas', {
        range: 'A1:B3',
        formulas: [['=A1']],
        fillDown: true,
      }),
    ).toThrow('column count');
    expect(harness.execute('read_range', { range: 'A1:B3' }).values[0][0]).toBe(
      'kept',
    );
  });

  it('resets the immutable seed and groups operations for each run', () => {
    const harness = new ExcelHarness({
      sheets: { 결과: { values: [['기준값']] } },
      activeSheet: '결과',
    });

    harness.startRun(1, 'cold');
    harness.execute('write_range', {
      sheet: '결과',
      range: 'A1',
      values: [['첫 실행 변경']],
    });
    harness.startRun(2, 'warm');

    expect(
      harness.execute('read_range', { sheet: '결과', range: 'A1' }).values,
    ).toEqual([['기준값']]);
    expect(harness.runOperations).toEqual([
      {
        runIndex: 1,
        kind: 'cold',
        operations: [
          {
            op: 'write_range',
            args: { sheet: '결과', range: 'A1', values: [['첫 실행 변경']] },
          },
        ],
      },
      {
        runIndex: 2,
        kind: 'warm',
        operations: [
          { op: 'read_range', args: { sheet: '결과', range: 'A1' } },
        ],
      },
    ]);
  });

  it('reports used ranges and mutates writes, clears, and added worksheets', () => {
    const harness = new ExcelHarness({
      sheets: {
        원천자료: {
          usedRange: 'A1:B2',
          values: [
            ['거래일', '금액'],
            ['2026-07-01', 1000],
          ],
          formulas: [
            ['', ''],
            ['', '=500+500'],
          ],
        },
      },
      activeSheet: '원천자료',
    });

    expect(harness.execute('get_workbook_overview')).toMatchObject({
      activeSheet: '원천자료',
      selection: '원천자료!A1',
      sheets: [{ name: '원천자료', usedRange: 'A1:B2', rows: 2, cols: 2 }],
    });
    harness.execute('write_range', {
      sheet: '원천자료',
      range: 'B2',
      values: [[2000]],
    });
    expect(
      harness.execute('read_range', { sheet: '원천자료', range: 'B2' }),
    ).toMatchObject({
      values: [[2000]],
      formulas: [['']],
    });
    harness.execute('clear_range', { sheet: '원천자료', range: 'A2:B2' });
    expect(
      harness.execute('read_range', { sheet: '원천자료', range: 'A2:B2' })
        .values,
    ).toEqual([['', '']]);
    harness.execute('add_worksheet', { name: '추가' });
    expect(harness.sheets.has('추가')).toBe(true);
    expect(harness.execute('read_range', { range: 'A1' }).address).toBe(
      '추가!A1',
    );
  });

  it('preserves cell contents when only formats are cleared', () => {
    const harness = new ExcelHarness({
      sheets: { 결과: { values: [['값']], formulas: [['=1']] } },
      activeSheet: '결과',
    });

    expect(
      harness.execute('clear_range', {
        sheet: '결과',
        range: 'A1',
        applyTo: 'formats',
      }),
    ).toEqual({ cleared: '결과!A1', applyTo: 'Formats' });
    expect(
      harness.execute('read_range', { sheet: '결과', range: 'A1' }),
    ).toMatchObject({
      values: [['값']],
      formulas: [['=1']],
    });
  });

  it('finds seeded values case-insensitively and caps results at 100', () => {
    const harness = new ExcelHarness({
      sheets: {
        원천자료: {
          usedRange: 'A1:A102',
          values: [
            ['헤더'],
            ...Array.from({ length: 101 }, (_, index) => [`Match-${index}`]),
          ],
        },
      },
      activeSheet: '원천자료',
    });

    const result = harness.execute('find', {
      sheet: '원천자료',
      query: 'mAtCh-',
    });

    expect(result.matches).toHaveLength(100);
    expect(result.matches[0]).toEqual({ address: 'A2', value: 'Match-0' });
    expect(result.matches.at(-1)).toEqual({
      address: 'A101',
      value: 'Match-99',
    });
    expect(result.truncated).toBe(true);
  });

  it('rejects missing, blank, and duplicate worksheet names', () => {
    const harness = new ExcelHarness({
      sheets: { 기존: { values: [['보존']] } },
      activeSheet: '기존',
    });

    expect(() => harness.execute('add_worksheet')).toThrow(
      "'name' argument is required",
    );
    expect(() => harness.execute('add_worksheet', { name: '   ' })).toThrow(
      "'name' argument is required",
    );
    expect(() => harness.execute('add_worksheet', { name: '기존' })).toThrow(
      'Worksheet already exists: 기존',
    );
    expect(
      harness.execute('read_range', { sheet: '기존', range: 'A1' }).values,
    ).toEqual([['보존']]);
  });

  it('records worksheet writes and returns deterministic RPC results', () => {
    const harness = new ExcelHarness();

    expect(harness.execute('add_worksheet', { name: '수납원장' })).toEqual({
      added: '수납원장',
    });
    expect(
      harness.execute('write_range', {
        sheet: '수납원장',
        range: 'A1',
        values: [
          ['수납번호', '금액'],
          ['R-1', 1000],
        ],
      }),
    ).toEqual({ written: '수납원장!A1:B2', rows: 2, cols: 2 });
    expect(harness.operations).toHaveLength(2);
    expect(harness.sheets.has('수납원장')).toBe(true);
  });
});

describe('buildBenchmarkManifest', () => {
  it('never labels a sidecar harness as an actual task pane run', () => {
    expect(
      buildBenchmarkManifest({
        app: 'excel',
        stage: 'stage-00-baseline',
        runs: [],
      }),
    ).toMatchObject({
      app: 'excel',
      stage: 'stage-00-baseline',
      measurementPath: 'full-path-harness',
    });
  });

  it('reports pane-to-ready from connection lifecycle events', () => {
    const manifest = buildBenchmarkManifest({
      app: 'powerpoint',
      stage: 'stage-01-observability',
      runs: [],
      connectionEvents: [
        { name: 'taskpane_connected', atMs: 10 },
        { name: 'query_spawn_started', atMs: 20 },
        { name: 'cli_initialized', atMs: 410 },
        { name: 'hello_ok_received', atMs: 412 },
      ],
    });
    expect(manifest.connection).toMatchObject({
      paneToQuerySpawnMs: 10,
      querySpawnToCliReadyMs: 390,
      paneToReadyMs: 400,
      paneToHelloOkMs: 402,
    });
  });

  it('retains timeout metadata with partial run evidence', () => {
    expect(
      buildBenchmarkManifest({
        app: 'excel',
        stage: 'fill-down-remeasure',
        runs: [{ index: 1, kind: 'cold', assistantText: 'partial' }],
        failure: {
          code: 'BENCHMARK_TIMEOUT',
          message: 'Benchmark timed out after 50000ms',
          atMs: 50001,
        },
      }),
    ).toMatchObject({
      runCount: 1,
      failure: {
        code: 'BENCHMARK_TIMEOUT',
        atMs: 50001,
      },
      runs: [{ assistantText: 'partial' }],
    });
  });
});
