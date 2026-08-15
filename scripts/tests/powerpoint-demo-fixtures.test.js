/**
 * @license
 * Copyright 2026 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  POWERPOINT_TEMPLATE_REPORT_PROMPT,
  buildPowerPointDemoFixtures,
  writePowerPointDemoFixtures,
} from '../addin-performance/powerpoint-demo-fixtures.mjs';

const tempDirectories = [];
const owners = ['김민지', '박준호', '이서연', '최도윤'];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('PowerPoint prose demo fixtures', () => {
  it.each([
    ['short', 500, 900],
    ['medium', 1_200, 1_800],
    ['long', 2_200, 3_200],
  ])(
    'builds %s as natural Korean prose in the required length band',
    (name, minimum, maximum) => {
      const prose = buildPowerPointDemoFixtures()[name];

      expect(prose.length).toBeGreaterThanOrEqual(minimum);
      expect(prose.length).toBeLessThanOrEqual(maximum);
      expect(prose).toContain('2026-07-19');
      expect(prose).toContain('기획전략부');
      expect(prose).toMatch(/결정/);
      expect(prose).toMatch(/기한|마감/);
      expect(prose).toMatch(/위험|리스크/);
      expect(prose).toMatch(/승인/);
      for (const owner of owners) {
        expect(prose).toContain(owner);
      }
      expect(prose).not.toMatch(/^\s*#{1,6}\s/m);
      expect(prose).not.toContain('|');
      expect(prose).not.toContain('\uFFFD');
    },
  );

  it('writes UTF-8 fixtures and the exact Korean template-report prompt', async () => {
    const outputDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'powerpoint-demo-fixtures-'),
    );
    tempDirectories.push(outputDir);

    await writePowerPointDemoFixtures(outputDir);

    const prompt = await fs.readFile(
      path.join(outputDir, 'prompt.txt'),
      'utf8',
    );
    expect(prompt).toBe(
      [
        '/template-report',
        '',
        '아래 줄글 회의록을 첨부한 제출양식에 맞춰 PPTX 보고서로 만드세요.',
        '내용 길이에 따라 1~3페이지로 나누고 결과 파일만 저장하세요.',
      ].join('\n'),
    );
    expect(prompt).toBe(POWERPOINT_TEMPLATE_REPORT_PROMPT);

    const fixtures = buildPowerPointDemoFixtures();
    for (const name of ['short', 'medium', 'long']) {
      const written = await fs.readFile(
        path.join(outputDir, `${name}.txt`),
        'utf8',
      );
      expect(written).toBe(fixtures[name]);
      expect(written).not.toContain('\uFFFD');
    }
  });
});
