/**
 * @license
 * Copyright 2026 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateFixtureFiles } from '../addin-performance/generate-fixtures.mjs';

const tempRoots = [];

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('generateFixtureFiles', () => {
  it('writes stable Excel and PowerPoint inputs with hashes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'moli-addin-fixtures-'));
    tempRoots.push(root);

    const result = await generateFixtureFiles(root);

    expect(result.receipts.rows).toHaveLength(63);
    expect(result.receipts.monthTotal).toBe(18417000);
    expect(result.files).toEqual([
      'excel/2026-07-receipts.json',
      'excel/prompt.txt',
      'powerpoint/2026-07-19-meeting-minutes.md',
      'powerpoint/prompt.txt',
    ]);
    const meeting = await readFile(
      path.join(root, 'powerpoint', '2026-07-19-meeting-minutes.md'),
      'utf8',
    );
    expect(meeting).toContain('# 2026년 7월 19일 디지털 운영 개선 회의록');
    expect(meeting).toContain('회의일: 2026-07-19');
    expect(meeting).toContain('| 실행 과제 | 담당자 | 완료 예정일 |');
    expect(meeting).toContain('## 위험 및 대응');

    for (const relativePath of result.files) {
      const content = await readFile(path.join(root, relativePath), 'utf8');
      const hashFile = await readFile(
        `${path.join(root, relativePath)}.sha256`,
        'utf8',
      );
      expect(content.length).toBeGreaterThan(20);
      expect(hashFile).toMatch(/^[a-f0-9]{64} {2}/);
    }
  });
});
