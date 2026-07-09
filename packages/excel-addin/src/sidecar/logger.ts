/**
 * Minimal file logger. The sidecar runs hidden on Windows (no console), so
 * everything goes to a log file; console output is kept for dev mode.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_LOG_BYTES = 5 * 1024 * 1024;

export class Logger {
  private readonly filePath: string | null;
  private readonly minLevel: LogLevel;
  private readonly mirrorToConsole: boolean;

  constructor(options: {
    filePath?: string;
    minLevel?: LogLevel;
    mirrorToConsole?: boolean;
  }) {
    this.filePath = options.filePath ?? null;
    this.minLevel = options.minLevel ?? 'info';
    this.mirrorToConsole = options.mirrorToConsole ?? false;
    if (this.filePath) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      this.rotateIfNeeded();
    }
  }

  debug(msg: string): void {
    this.write('debug', msg);
  }

  info(msg: string): void {
    this.write('info', msg);
  }

  warn(msg: string): void {
    this.write('warn', msg);
  }

  error(msg: string, err?: unknown): void {
    const detail =
      err instanceof Error
        ? ` :: ${err.stack ?? err.message}`
        : err !== undefined
          ? ` :: ${String(err)}`
          : '';
    this.write('error', msg + detail);
  }

  private write(level: LogLevel, msg: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) {
      return;
    }
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${msg}`;
    if (this.filePath) {
      try {
        fs.appendFileSync(this.filePath, line + '\n', 'utf8');
      } catch {
        // Logging must never crash the sidecar.
      }
    }
    if (this.mirrorToConsole) {
      // eslint-disable-next-line no-console
      console.error(line);
    }
  }

  private rotateIfNeeded(): void {
    if (!this.filePath) {
      return;
    }
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.size > MAX_LOG_BYTES) {
        fs.renameSync(this.filePath, `${this.filePath}.1`);
      }
    } catch {
      // File may not exist yet.
    }
  }
}
