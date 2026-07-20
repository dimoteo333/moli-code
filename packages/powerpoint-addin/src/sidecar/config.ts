/**
 * Sidecar configuration, loaded from a config.json written by the installer
 * (or generated for dev by scripts/dev.js).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const DEFAULT_PORT = 39216;

export interface SidecarConfig {
  port: number;
  /** PFX (PKCS#12) bundle with the localhost certificate + key. */
  certPfxPath: string;
  certPassphrase: string;
  /** PEM alternative (dev mode); used when the PFX file doesn't exist. */
  certPemCertPath?: string;
  certPemKeyPath?: string;
  /** Path to the moli CLI executable (.js or native). Empty → auto-resolve. */
  cliPath?: string;
  /** Agent working directory. */
  workDir: string;
  /** Tool patterns blocked for the agent (user-editable). */
  excludeTools: string[];
  /** Model override; empty → CLI default. */
  model?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface RawConfig {
  port?: number;
  certPfxPath?: string;
  certPassphrase?: string;
  certPemCertPath?: string;
  certPemKeyPath?: string;
  cliPath?: string;
  workDir?: string;
  excludeTools?: string[];
  model?: string;
  logLevel?: string;
}

export function defaultInstallDir(): string {
  if (process.platform === 'win32' && process.env['LOCALAPPDATA']) {
    return path.join(
      process.env['LOCALAPPDATA'],
      'MoliCode',
      'PowerPointAddin',
    );
  }
  return path.join(os.homedir(), '.moli', 'powerpoint-addin');
}

/**
 * Where the sidecar itself lives (dist dir in dev, exe dir when packaged as
 * a SEA). Used to find sibling folders: web/, cli/, certs/.
 */
export function sidecarRoot(): string {
  if (isSeaBinary()) {
    return path.dirname(process.execPath);
  }
  // dist/sidecar/index.js → dist root is one level up.
  return path.resolve(moduleDir(), '..');
}

function moduleDir(): string {
  // CJS bundle: esbuild provides a real __dirname.
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    // Falls through to the SEA path.
  }
  return path.dirname(process.execPath);
}

function isSeaBinary(): boolean {
  try {
    const req = createRequire(process.execPath);
    const sea = req('node:sea') as { isSea?: () => boolean };
    return typeof sea.isSea === 'function' && sea.isSea();
  } catch {
    return false;
  }
}

export function loadConfig(configPath: string): SidecarConfig {
  let raw: RawConfig = {};
  if (fs.existsSync(configPath)) {
    // Strip a UTF-8 BOM (U+FEFF): Windows PowerShell 5.1 (installer) and
    // Notepad both write one, and JSON.parse rejects it.
    let text = fs.readFileSync(configPath, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    raw = JSON.parse(text) as RawConfig;
  }
  const root = path.dirname(configPath);
  const workDir = raw.workDir ?? 'workspace';

  return {
    port: raw.port ?? DEFAULT_PORT,
    certPfxPath: resolveMaybeRelative(
      raw.certPfxPath ?? 'certs/localhost.pfx',
      root,
    ),
    certPassphrase: raw.certPassphrase ?? '',
    certPemCertPath: raw.certPemCertPath
      ? resolveMaybeRelative(raw.certPemCertPath, root)
      : undefined,
    certPemKeyPath: raw.certPemKeyPath
      ? resolveMaybeRelative(raw.certPemKeyPath, root)
      : undefined,
    cliPath: resolveCliPath(raw.cliPath, root),
    workDir: resolveMaybeRelative(workDir, root),
    excludeTools: raw.excludeTools ?? ['ShellTool', 'web_fetch', 'web_search'],
    model: raw.model,
    logLevel: normalizeLogLevel(raw.logLevel),
  };
}

/**
 * CLI resolution chain: explicit config → MOLI_CODE_CLI_PATH env → bundled
 * cli/cli.js next to the sidecar → undefined (SDK auto-resolution).
 */
function resolveCliPath(
  configured: string | undefined,
  root: string,
): string | undefined {
  if (configured) {
    return resolveMaybeRelative(configured, root);
  }
  if (process.env['MOLI_CODE_CLI_PATH']) {
    return process.env['MOLI_CODE_CLI_PATH'];
  }
  const bundled = path.join(root, 'cli', 'cli.js');
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  const bundledNextToExe = path.join(sidecarRoot(), 'cli', 'cli.js');
  if (fs.existsSync(bundledNextToExe)) {
    return bundledNextToExe;
  }
  return undefined;
}

function resolveMaybeRelative(p: string, root: string): string {
  return path.isAbsolute(p) ? p : path.resolve(root, p);
}

function normalizeLogLevel(
  level: string | undefined,
): SidecarConfig['logLevel'] {
  if (
    level === 'debug' ||
    level === 'info' ||
    level === 'warn' ||
    level === 'error'
  ) {
    return level;
  }
  return 'info';
}
