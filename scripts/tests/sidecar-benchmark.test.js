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
});
