/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isCommandAvailable } from '../utils/shell-utils.js';
import { getCachedEncodingForBuffer } from '../utils/systemEncoding.js';
import { iconvDecode, iconvEncodingExists } from '../utils/iconvHelper.js';

/**
 * Result of a single `cvs` invocation.
 */
export interface CvsExecResult {
  /** The full command line that was executed (for display purposes). */
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Options accepted by {@link CvsService.diff}.
 */
export interface CvsDiffOptions {
  /** Compare against a specific revision or tag (`-r`). */
  revision?: string;
  /** Compare against a second revision or tag (second `-r`). */
  revision2?: string;
  /** Produce a context diff instead of a unified diff. */
  contextDiff?: boolean;
}

/**
 * Options accepted by {@link CvsService.update}.
 */
export interface CvsUpdateOptions {
  /** Create directories added to the repository since checkout (`-d`). */
  createDirs?: boolean;
  /** Prune empty directories (`-P`). */
  prune?: boolean;
  /** Update to a specific revision or tag (`-r`). */
  revision?: string;
  /** Reset any sticky tags/dates/kopts (`-A`). */
  clearStickyTags?: boolean;
}

/**
 * Options accepted by {@link CvsService.log}.
 */
export interface CvsLogOptions {
  /** Only print the header (per-file summary) information (`-h`). */
  headerOnly?: boolean;
  /** Restrict output to the given revision or range (`-r`). */
  revisionRange?: string;
}

/**
 * Default timeout for CVS operations. Legacy CVS servers over slow links can
 * take a while, so this is intentionally generous.
 */
const DEFAULT_CVS_TIMEOUT_MS = 120_000;

/**
 * Decodes process output produced by the `cvs` client. Legacy Windows
 * environments frequently emit CP949/EUC-KR (or other locale) encoded text, so
 * decoding goes through encoding detection rather than assuming UTF-8.
 */
function decodeOutput(buffer: Buffer): string {
  if (buffer.length === 0) {
    return '';
  }
  const encoding = getCachedEncodingForBuffer(buffer);
  if (encoding && encoding !== 'utf-8' && iconvEncodingExists(encoding)) {
    try {
      return iconvDecode(buffer, encoding);
    } catch {
      // Fall through to UTF-8 decoding below.
    }
  }
  return buffer.toString('utf-8');
}

/**
 * A thin service wrapper around the `cvs` command-line client, aimed at
 * legacy (mainly Windows) environments where projects are still versioned
 * with CVS/CVSNT instead of git.
 *
 * All commands run with `shell: false`, so arguments (including commit
 * messages) are passed verbatim and never re-interpreted by cmd.exe.
 */
export class CvsService {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  /** Whether a `cvs` client is available on the PATH. */
  static isCvsAvailable(): boolean {
    return isCommandAvailable('cvs').available;
  }

  /**
   * Whether the given directory is a CVS working copy (contains the
   * `CVS/Root` administrative file that every checked-out directory has).
   */
  static isCvsWorkspace(dir: string): boolean {
    try {
      return fs.statSync(path.join(dir, 'CVS', 'Root')).isFile();
    } catch {
      return false;
    }
  }

  isWorkspace(): boolean {
    return CvsService.isCvsWorkspace(this.projectRoot);
  }

  /**
   * Reads the CVSROOT (`CVS/Root`) and module path (`CVS/Repository`) of the
   * working copy, if present.
   */
  getRepositoryInfo(): { root?: string; repository?: string } {
    const info: { root?: string; repository?: string } = {};
    for (const [key, file] of [
      ['root', 'Root'],
      ['repository', 'Repository'],
    ] as const) {
      try {
        info[key] = fs
          .readFileSync(path.join(this.projectRoot, 'CVS', file), 'utf-8')
          .trim();
      } catch {
        // Not fatal; the field simply stays undefined.
      }
    }
    return info;
  }

  /**
   * `cvs diff -u [paths...]` — shows local modifications. CVS (like diff)
   * exits with 1 when differences exist, so exit codes 0 and 1 are both
   * treated as success by callers via {@link isDiffSuccess}.
   */
  async diff(
    paths: string[] = [],
    options: CvsDiffOptions = {},
    signal?: AbortSignal,
  ): Promise<CvsExecResult> {
    const args = ['diff', options.contextDiff ? '-c' : '-u'];
    if (options.revision) {
      args.push('-r', options.revision);
    }
    if (options.revision2) {
      args.push('-r', options.revision2);
    }
    return this.run([...args, ...paths], signal);
  }

  /** `cvs -n -q update [paths...]` — dry-run listing of workspace state. */
  async status(
    paths: string[] = [],
    signal?: AbortSignal,
  ): Promise<CvsExecResult> {
    // `cvs -n -q update` gives the familiar one-letter-per-file summary
    // (M/A/R/C/U/?) and is far more readable than `cvs status` output.
    return this.run(['-n', '-q', 'update', '-d', ...paths], signal);
  }

  /** `cvs update [-d] [-P] [paths...]` — brings the workspace up to date. */
  async update(
    paths: string[] = [],
    options: CvsUpdateOptions = {},
    signal?: AbortSignal,
  ): Promise<CvsExecResult> {
    const args = ['update'];
    if (options.createDirs ?? true) {
      args.push('-d');
    }
    if (options.prune ?? true) {
      args.push('-P');
    }
    if (options.clearStickyTags) {
      args.push('-A');
    }
    if (options.revision) {
      args.push('-r', options.revision);
    }
    return this.run([...args, ...paths], signal);
  }

  /**
   * `cvs commit -m <message> [paths...]` — commits local changes. The message
   * is passed as a single argv entry (no shell), so multi-line and Korean
   * messages are safe on Windows.
   */
  async commit(
    message: string,
    paths: string[] = [],
    signal?: AbortSignal,
  ): Promise<CvsExecResult> {
    if (!message.trim()) {
      throw new Error('CVS commit requires a non-empty commit message.');
    }
    return this.run(['commit', '-m', message, ...paths], signal);
  }

  /** `cvs add [paths...]` — schedules new files/directories for addition. */
  async add(paths: string[], signal?: AbortSignal): Promise<CvsExecResult> {
    if (paths.length === 0) {
      throw new Error('CVS add requires at least one path.');
    }
    return this.run(['add', ...paths], signal);
  }

  /** `cvs remove -f [paths...]` — deletes files and schedules their removal. */
  async remove(paths: string[], signal?: AbortSignal): Promise<CvsExecResult> {
    if (paths.length === 0) {
      throw new Error('CVS remove requires at least one path.');
    }
    return this.run(['remove', '-f', ...paths], signal);
  }

  /** `cvs log [paths...]` — revision history. */
  async log(
    paths: string[] = [],
    options: CvsLogOptions = {},
    signal?: AbortSignal,
  ): Promise<CvsExecResult> {
    const args = ['log'];
    if (options.headerOnly) {
      args.push('-h');
    }
    if (options.revisionRange) {
      args.push(`-r${options.revisionRange}`);
    }
    return this.run([...args, ...paths], signal);
  }

  /**
   * `cvs diff` (and the underlying diff) uses exit code 1 for "differences
   * found", which is not an error.
   */
  static isDiffSuccess(result: CvsExecResult): boolean {
    return result.exitCode === 0 || result.exitCode === 1;
  }

  private run(args: string[], signal?: AbortSignal): Promise<CvsExecResult> {
    // `-f` skips ~/.cvsrc so behavior is predictable across machines. Global
    // options (`-n`, `-q`, ...) supplied by callers also come before the
    // subcommand, which CVS accepts in any order among global options.
    const fullArgs = ['-f', ...args];
    return new Promise((resolve, reject) => {
      const child = spawn('cvs', fullArgs, {
        cwd: this.projectRoot,
        shell: false,
        windowsHide: true,
        signal,
        timeout: DEFAULT_CVS_TIMEOUT_MS,
        env: process.env,
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      child.on('error', (err) => {
        reject(
          new Error(
            `Failed to run 'cvs ${args.join(' ')}': ${err.message}. ` +
              `Ensure a CVS client (e.g. CVSNT) is installed and on the PATH.`,
          ),
        );
      });

      child.on('close', (code) => {
        resolve({
          command: `cvs ${fullArgs.join(' ')}`,
          stdout: decodeOutput(Buffer.concat(stdoutChunks)),
          stderr: decodeOutput(Buffer.concat(stderrChunks)),
          exitCode: code,
        });
      });
    });
  }
}
