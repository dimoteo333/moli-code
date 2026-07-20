/**
 * Copy the moli CLI bundle (repo dist/cli.js + vendor + locales) into a
 * target directory. Mirror of packages/sdk-typescript/scripts/bundle-cli.js.
 *
 * Usage: node scripts/bundle-cli.js [targetDir=deploy/cli]
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgRoot, '..', '..');

function ensureRootBundle() {
  const rootCliJs = join(repoRoot, 'dist', 'cli.js');
  if (existsSync(rootCliJs)) return;
  console.log('[bundle-cli] Root CLI bundle missing; running `npm run bundle`');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['run', 'bundle'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    throw new Error('`npm run bundle` failed at repo root');
  }
}

export function bundleCli(targetDir) {
  ensureRootBundle();
  const rootDistDir = join(repoRoot, 'dist');
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(rootDistDir, 'cli.js'), join(targetDir, 'cli.js'));
  for (const extra of ['vendor', 'locales']) {
    const src = join(rootDistDir, extra);
    if (existsSync(src)) {
      cpSync(src, join(targetDir, extra), { recursive: true });
    }
  }
  console.log(`[bundle-cli] CLI copied → ${targetDir}`);
}

const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  bundleCli(resolve(process.argv[2] ?? join(pkgRoot, 'deploy', 'cli')));
}
