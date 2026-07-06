/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CvsTool } from './cvs.js';
import type { Config } from '../config/config.js';
import type { CvsExecResult } from '../services/cvsService.js';
import { ToolConfirmationOutcome } from './tools.js';

const mocks = vi.hoisted(() => ({
  diff: vi.fn(),
  status: vi.fn(),
  update: vi.fn(),
  commit: vi.fn(),
  log: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../services/cvsService.js', () => ({
  CvsService: class {
    diff = mocks.diff;
    status = mocks.status;
    update = mocks.update;
    commit = mocks.commit;
    log = mocks.log;
    add = mocks.add;
    remove = mocks.remove;
    static isDiffSuccess(r: CvsExecResult) {
      return r.exitCode === 0 || r.exitCode === 1;
    }
    static isCvsWorkspace() {
      return true;
    }
  },
}));

function execResult(overrides: Partial<CvsExecResult> = {}): CvsExecResult {
  return {
    command: 'cvs -f diff -u',
    stdout: '',
    stderr: '',
    exitCode: 0,
    ...overrides,
  };
}

describe('CvsTool', () => {
  let tool: CvsTool;
  const config = { getTargetDir: () => '/project' } as unknown as Config;
  const signal = new AbortController().signal;

  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    tool = new CvsTool(config);
  });

  describe('validation', () => {
    it('rejects commit without a message', () => {
      expect(() => tool.build({ operation: 'commit' })).toThrow(
        /non-empty `message`/,
      );
    });

    it('rejects add without paths', () => {
      expect(() => tool.build({ operation: 'add' })).toThrow(
        /at least one entry/,
      );
    });

    it('rejects paths escaping the project root', () => {
      expect(() =>
        tool.build({ operation: 'diff', paths: ['../outside.c'] }),
      ).toThrow(/within the project root/);
    });
  });

  describe('confirmation', () => {
    it('does not ask for read-only operations', async () => {
      const invocation = tool.build({ operation: 'diff' });
      expect(await invocation.shouldConfirmExecute(signal)).toBe(false);
      const status = tool.build({ operation: 'status' });
      expect(await status.shouldConfirmExecute(signal)).toBe(false);
    });

    it('asks before commit and honors ProceedAlways', async () => {
      const invocation = tool.build({
        operation: 'commit',
        message: 'fix bug',
      });
      const details = await invocation.shouldConfirmExecute(signal);
      expect(details).not.toBe(false);
      if (details === false) throw new Error('unreachable');
      expect(details.type).toBe('exec');

      await details.onConfirm(ToolConfirmationOutcome.ProceedAlways);

      const second = tool.build({
        operation: 'commit',
        message: 'another fix',
      });
      expect(await second.shouldConfirmExecute(signal)).toBe(false);

      // Other mutating operations still require confirmation.
      const update = tool.build({ operation: 'update' });
      expect(await update.shouldConfirmExecute(signal)).not.toBe(false);
    });
  });

  describe('execute', () => {
    it('treats diff exit code 1 (differences found) as success', async () => {
      mocks.diff.mockResolvedValue(
        execResult({ stdout: 'Index: foo.c\n+new\n', exitCode: 1 }),
      );
      const result = await tool.build({ operation: 'diff' }).execute(signal);
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('+new');
      expect(result.llmContent).toContain('exit code: 1');
    });

    it('passes message and paths to commit', async () => {
      mocks.commit.mockResolvedValue(
        execResult({ stdout: 'new revision: 1.5' }),
      );
      const result = await tool
        .build({
          operation: 'commit',
          message: '결제 모듈 버그 수정',
          paths: ['src/pay.c'],
        })
        .execute(signal);
      expect(mocks.commit).toHaveBeenCalledWith(
        '결제 모듈 버그 수정',
        ['src/pay.c'],
        signal,
      );
      expect(result.error).toBeUndefined();
    });

    it('reports non-zero exit codes as errors', async () => {
      mocks.update.mockResolvedValue(
        execResult({
          stderr: 'cvs [update aborted]: connect to cvs.example.com failed',
          exitCode: 1,
        }),
      );
      const result = await tool.build({ operation: 'update' }).execute(signal);
      expect(result.error).toBeDefined();
      expect(result.llmContent).toContain('connect to cvs.example.com failed');
    });

    it('surfaces thrown service errors as tool errors', async () => {
      mocks.status.mockRejectedValue(new Error('spawn cvs ENOENT'));
      const result = await tool.build({ operation: 'status' }).execute(signal);
      expect(result.error).toBeDefined();
      expect(result.llmContent).toContain('ENOENT');
    });
  });
});
