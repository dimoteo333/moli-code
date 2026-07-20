import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile: execFileMock }));

import { generatePowerPointReport } from '../src/sidecar/report-generator.js';

const attachment = {
  name: 'minutes.md',
  content: '# Meeting report',
  size: 16,
  mimeType: 'text/markdown',
};

describe('legacy report process wrapper', () => {
  let workRoot: string;
  let tasklistCalls: number;

  beforeEach(async () => {
    workRoot = await mkdtemp(path.join(tmpdir(), 'moli-legacy-report-'));
    tasklistCalls = 0;
    execFileMock.mockReset();
    execFileMock.mockImplementation((file, args, _options, callback) => {
      if (file === 'tasklist.exe') {
        tasklistCalls += 1;
        callback(
          null,
          tasklistCalls === 1
            ? '"POWERPNT.EXE","101"\r\n'
            : '"POWERPNT.EXE","101"\r\n"POWERPNT.EXE","202"\r\n',
          '',
        );
        return;
      }
      if (file === 'taskkill.exe') {
        callback(null, 'SUCCESS', '');
        return;
      }
      const marker = args[args.indexOf('-ProcessMarkerPath') + 1];
      void writeFile(marker, '202', 'ascii').then(() =>
        callback(
          Object.assign(new Error('timed out'), {
            code: 'ETIMEDOUT',
            killed: true,
          }),
          '',
          '',
        ),
      );
    });
  });

  afterEach(async () => {
    await rm(workRoot, { recursive: true, force: true });
  });

  it('attributes timeout cleanup to the newly observed PowerPoint PID only', async () => {
    await expect(
      generatePowerPointReport(
        attachment,
        path.join(workRoot, 'reports'),
        workRoot,
      ),
    ).rejects.toThrow('timed out');

    const generatorCall = execFileMock.mock.calls.find(
      ([file]) => file === 'powershell.exe',
    );
    expect(generatorCall[1]).toEqual(
      expect.arrayContaining([
        '-PreexistingPowerPointPids',
        '101',
        '-ProcessMarkerPath',
      ]),
    );
    const marker =
      generatorCall[1][generatorCall[1].indexOf('-ProcessMarkerPath') + 1];
    await expect(readFile(marker, 'ascii')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    const killCalls = execFileMock.mock.calls.filter(
      ([file]) => file === 'taskkill.exe',
    );
    expect(killCalls).toHaveLength(1);
    expect(killCalls[0][1]).toEqual(expect.arrayContaining(['/PID', '202']));
    expect(killCalls[0][1]).not.toContain('101');
  });
});
