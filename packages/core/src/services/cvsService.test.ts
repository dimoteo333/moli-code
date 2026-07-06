/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CvsService } from './cvsService.js';

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: spawnMock };
});

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function makeFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

function emitAndClose(
  child: FakeChild,
  {
    stdout = '',
    stderr = '',
    code = 0,
  }: { stdout?: string; stderr?: string; code?: number },
) {
  process.nextTick(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', code);
  });
}

describe('CvsService', () => {
  let tmpDir: string;
  let service: CvsService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cvs-service-test-'));
    service = new CvsService(tmpDir);
    spawnMock.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('isCvsWorkspace', () => {
    it('returns false when no CVS admin directory exists', () => {
      expect(CvsService.isCvsWorkspace(tmpDir)).toBe(false);
      expect(service.isWorkspace()).toBe(false);
    });

    it('returns true when CVS/Root exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'CVS'));
      fs.writeFileSync(
        path.join(tmpDir, 'CVS', 'Root'),
        ':pserver:user@cvs.example.com:/cvsroot\n',
      );
      expect(CvsService.isCvsWorkspace(tmpDir)).toBe(true);
      expect(service.isWorkspace()).toBe(true);
    });
  });

  describe('containsCvsWorkspace', () => {
    it('returns false when no CVS working copy exists under the directory', () => {
      fs.mkdirSync(path.join(tmpDir, 'project-a'), { recursive: true });

      expect(CvsService.containsCvsWorkspace(tmpDir)).toBe(false);
    });

    it('returns true when the directory itself is a CVS working copy', () => {
      fs.mkdirSync(path.join(tmpDir, 'CVS'));
      fs.writeFileSync(
        path.join(tmpDir, 'CVS', 'Root'),
        ':pserver:user@cvs.example.com:/cvsroot\n',
      );

      expect(CvsService.containsCvsWorkspace(tmpDir)).toBe(true);
    });

    it('returns true when a descendant directory is a CVS working copy', () => {
      const childWorkspace = path.join(tmpDir, 'group', 'project-a');
      fs.mkdirSync(path.join(childWorkspace, 'CVS'), { recursive: true });
      fs.writeFileSync(
        path.join(childWorkspace, 'CVS', 'Root'),
        ':pserver:user@cvs.example.com:/cvsroot\n',
      );

      expect(CvsService.isCvsWorkspace(tmpDir)).toBe(false);
      expect(CvsService.containsCvsWorkspace(tmpDir)).toBe(true);
    });
  });

  describe('getRepositoryInfo', () => {
    it('reads Root and Repository admin files', () => {
      fs.mkdirSync(path.join(tmpDir, 'CVS'));
      fs.writeFileSync(
        path.join(tmpDir, 'CVS', 'Root'),
        ':pserver:user@cvs.example.com:/cvsroot\n',
      );
      fs.writeFileSync(path.join(tmpDir, 'CVS', 'Repository'), 'mymodule\n');
      expect(service.getRepositoryInfo()).toEqual({
        root: ':pserver:user@cvs.example.com:/cvsroot',
        repository: 'mymodule',
      });
    });

    it('returns empty info when admin files are missing', () => {
      expect(service.getRepositoryInfo()).toEqual({});
    });
  });

  describe('diff', () => {
    it('runs cvs -f diff -u and captures output', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      emitAndClose(child, {
        stdout: 'Index: foo.c\n+added line\n',
        code: 1, // cvs diff exits 1 when differences exist
      });

      const result = await service.diff(['foo.c']);

      expect(spawnMock).toHaveBeenCalledWith(
        'cvs',
        ['-f', 'diff', '-u', 'foo.c'],
        expect.objectContaining({ cwd: tmpDir, shell: false }),
      );
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('+added line');
      expect(CvsService.isDiffSuccess(result)).toBe(true);
    });

    it('passes revisions with -r flags', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      emitAndClose(child, { code: 0 });

      await service.diff([], { revision: '1.2', revision2: '1.5' });

      expect(spawnMock).toHaveBeenCalledWith(
        'cvs',
        ['-f', 'diff', '-u', '-r', '1.2', '-r', '1.5'],
        expect.anything(),
      );
    });
  });

  describe('status', () => {
    it('uses a dry-run update for a compact summary', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      emitAndClose(child, { stdout: 'M src/foo.c\n? newfile.c\n' });

      const result = await service.status();

      expect(spawnMock).toHaveBeenCalledWith(
        'cvs',
        ['-f', '-n', '-q', 'update', '-d'],
        expect.anything(),
      );
      expect(result.stdout).toContain('M src/foo.c');
    });
  });

  describe('update', () => {
    it('defaults to -d -P', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      emitAndClose(child, { code: 0 });

      await service.update();

      expect(spawnMock).toHaveBeenCalledWith(
        'cvs',
        ['-f', 'update', '-d', '-P'],
        expect.anything(),
      );
    });

    it('supports -A and -r', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      emitAndClose(child, { code: 0 });

      await service.update(['src'], {
        clearStickyTags: true,
        revision: 'RELEASE_1_0',
        createDirs: false,
        prune: false,
      });

      expect(spawnMock).toHaveBeenCalledWith(
        'cvs',
        ['-f', 'update', '-A', '-r', 'RELEASE_1_0', 'src'],
        expect.anything(),
      );
    });
  });

  describe('commit', () => {
    it('passes the message as a single argv entry', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      emitAndClose(child, { code: 0 });

      await service.commit('버그 수정: 널 포인터 예외 처리', ['src/foo.c']);

      expect(spawnMock).toHaveBeenCalledWith(
        'cvs',
        ['-f', 'commit', '-m', '버그 수정: 널 포인터 예외 처리', 'src/foo.c'],
        expect.objectContaining({ shell: false }),
      );
    });

    it('rejects empty commit messages without spawning', async () => {
      await expect(service.commit('   ')).rejects.toThrow(
        /non-empty commit message/,
      );
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  describe('add/remove', () => {
    it('requires at least one path', async () => {
      await expect(service.add([])).rejects.toThrow(/at least one path/);
      await expect(service.remove([])).rejects.toThrow(/at least one path/);
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('supports header-only and revision ranges', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      emitAndClose(child, { code: 0 });

      await service.log(['foo.c'], {
        headerOnly: true,
        revisionRange: '1.1:1.5',
      });

      expect(spawnMock).toHaveBeenCalledWith(
        'cvs',
        ['-f', 'log', '-h', '-r1.1:1.5', 'foo.c'],
        expect.anything(),
      );
    });
  });

  describe('error handling', () => {
    it('rejects with a helpful message when cvs is missing', async () => {
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      process.nextTick(() => {
        child.emit('error', new Error('spawn cvs ENOENT'));
      });

      await expect(service.status()).rejects.toThrow(/CVSNT.*PATH|PATH/);
    });
  });
});
