/**
 * @license
 * Copyright 2026 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  generateReceipts,
  median,
  summarizeRun,
} from '../addin-performance/lib.mjs';

describe('Office add-in performance fixtures', () => {
  it('generates deterministic July 2026 receipts and ISO-week totals', () => {
    const fixture = generateReceipts(20260719);

    expect(fixture.rows).toHaveLength(63);
    expect(fixture.rows[0]).toMatchObject({
      date: '2026-07-01',
      category: '기타수입',
      amount: 375000,
    });
    expect(fixture.rows.at(-1)).toMatchObject({
      date: '2026-07-31',
      category: '수수료',
      amount: 270000,
    });
    expect(fixture.weeks).toEqual([
      { label: '1주차', from: '2026-07-01', to: '2026-07-05', total: 3284000 },
      { label: '2주차', from: '2026-07-06', to: '2026-07-12', total: 3470000 },
      { label: '3주차', from: '2026-07-13', to: '2026-07-19', total: 5089000 },
      { label: '4주차', from: '2026-07-20', to: '2026-07-26', total: 4212000 },
      { label: '5주차', from: '2026-07-27', to: '2026-07-31', total: 2362000 },
    ]);
    expect(fixture.monthTotal).toBe(18417000);
    expect(fixture.weeks.reduce((sum, week) => sum + week.total, 0)).toBe(
      fixture.monthTotal,
    );
  });

  it('computes medians without mutating the input', () => {
    const values = [600, 100, 300, 200];

    expect(median(values)).toBe(250);
    expect(values).toEqual([600, 100, 300, 200]);
  });

  it('separates add-in, model, and artifact intervals', () => {
    expect(
      summarizeRun([
        { name: 'taskpane_connected', atMs: 0 },
        { name: 'query_spawn_started', atMs: 20 },
        { name: 'cli_initialized', atMs: 90 },
        { name: 'user_message_sent', atMs: 100 },
        { name: 'api_request_started', atMs: 600 },
        { name: 'first_delta_received', atMs: 1600 },
        { name: 'artifact_saved', atMs: 2100 },
        { name: 'turn_completed', atMs: 2200 },
      ]),
    ).toEqual({
      paneToReadyMs: 90,
      sendToApiMs: 500,
      apiToFirstDeltaMs: 1000,
      sendToFirstDeltaMs: 1500,
      sendToArtifactMs: 2000,
      sendToCompleteMs: 2100,
    });
  });

  it('leaves an interval undefined when an endpoint is missing', () => {
    expect(
      summarizeRun([
        { name: 'user_message_sent', atMs: 100 },
        { name: 'turn_completed', atMs: 900 },
      ]),
    ).toEqual({
      paneToReadyMs: undefined,
      sendToApiMs: undefined,
      apiToFirstDeltaMs: undefined,
      sendToFirstDeltaMs: undefined,
      sendToArtifactMs: undefined,
      sendToCompleteMs: 800,
    });
  });
});
