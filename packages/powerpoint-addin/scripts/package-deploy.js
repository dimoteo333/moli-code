/**
 * Assemble the offline deployment folder and zip:
 *
 *   deploy/
 *     README.ko.md
 *     installer/install.ps1, uninstall.ps1
 *     manifest/manifest.template.xml
 *     web/                 task-pane assets (offline office.js included)
 *     sidecar/index.cjs    sidecar bundle
 *     sidecar/node.exe     Windows Node runtime (downloaded at package time)
 *     cli/cli.js (+vendor,locales)
 *
 * Build machine needs internet once (node.exe download, cached); the deploy
 * zip itself installs with zero network access.
 *
 * Usage: node scripts/package-deploy.js [--skip-node] [--node-version vX.Y.Z]
 */

import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleCli } from './bundle-cli.js';

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const deployDir = path.join(pkgRoot, 'deploy');
const version = JSON.parse(
  fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'),
).version;

const skipNode = process.argv.includes('--skip-node');
const nodeVersionArgIdx = process.argv.indexOf('--node-version');
// Match scripts/build_sea.sh: default to the build machine's Node version.
const nodeVersion =
  nodeVersionArgIdx >= 0
    ? process.argv[nodeVersionArgIdx + 1]
    : process.version;

function step(name) {
  console.log(`[package] ${name}`);
}

step('build');
execFileSync(process.execPath, [path.join(pkgRoot, 'scripts', 'build.js')], {
  cwd: pkgRoot,
  stdio: 'inherit',
});

step('assemble deploy/');
fs.rmSync(deployDir, { recursive: true, force: true });
fs.mkdirSync(path.join(deployDir, 'sidecar'), { recursive: true });
fs.cpSync(path.join(pkgRoot, 'dist', 'web'), path.join(deployDir, 'web'), {
  recursive: true,
});
fs.copyFileSync(
  path.join(pkgRoot, 'dist', 'sidecar', 'index.cjs'),
  path.join(deployDir, 'sidecar', 'index.cjs'),
);
fs.cpSync(path.join(pkgRoot, 'manifest'), path.join(deployDir, 'manifest'), {
  recursive: true,
});
fs.cpSync(path.join(pkgRoot, 'installer'), path.join(deployDir, 'installer'), {
  recursive: true,
});
const readmeSrc = path.join(pkgRoot, 'installer', 'README.ko.md');
if (fs.existsSync(readmeSrc)) {
  fs.copyFileSync(readmeSrc, path.join(deployDir, 'README.ko.md'));
}

step('bundle CLI');
bundleCli(path.join(deployDir, 'cli'));

if (!skipNode) {
  step(`fetch node.exe ${nodeVersion} (win-x64)`);
  const cacheDir = path.join(pkgRoot, '.node-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cached = path.join(cacheDir, `node-${nodeVersion}-win-x64.exe`);
  if (!fs.existsSync(cached)) {
    const url = `https://nodejs.org/dist/${nodeVersion}/win-x64/node.exe`;
    const res = spawnSync('curl', ['-fsSL', '-o', cached, url], {
      stdio: 'inherit',
    });
    if (res.status !== 0) {
      fs.rmSync(cached, { force: true });
      throw new Error(`node.exe download failed: ${url}`);
    }
  }
  fs.copyFileSync(cached, path.join(deployDir, 'sidecar', 'node.exe'));
} else {
  console.log(
    '[package] --skip-node: deploy zip will NOT be self-contained on Windows',
  );
}

step('zip');
const zipName = `moli-powerpoint-addin-${version}-offline.zip`;
const zipPath = path.join(pkgRoot, zipName);
fs.rmSync(zipPath, { force: true });
let zipRes = spawnSync('zip', ['-qr', zipPath, 'deploy'], {
  cwd: pkgRoot,
  stdio: 'inherit',
});
if (zipRes.status !== 0 && process.platform === 'win32') {
  // Windows has no zip CLI, but bsdtar (bundled since Windows 10 1803)
  // infers zip format from the -a flag and the .zip extension.
  // Relative archive path: bsdtar parses "C:\..." as a remote host.
  zipRes = spawnSync('tar', ['-a', '-c', '-f', zipName, 'deploy'], {
    cwd: pkgRoot,
    stdio: 'inherit',
  });
}
if (zipRes.status !== 0) {
  console.warn(
    '[package] zip failed or unavailable; deploy/ folder is still complete',
  );
} else {
  const mb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  console.log(`[package] ${zipName} (${mb} MB)`);
}
console.log(`[package] deploy folder: ${deployDir}`);
