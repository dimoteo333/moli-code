/**
 * Build the PowerPoint add-in package:
 *   1. typecheck (sidecar ES2022 config + taskpane ES5-lib config)
 *   2. esbuild sidecar  → dist/sidecar/index.cjs   (bundled, node20, CJS)
 *   3. esbuild taskpane → dist/web/taskpane.js      (iife, es2015)
 *   4. esbuild polyfills → dist/web/polyfills.js    (core-js subset)
 *   5. swc downlevel both web bundles to ES5 + es-check gate
 *   6. copy taskpane.html/styles.css + office.js/fabric offline assets
 */

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downlevelFile, esCheck } from './downlevel-es5.js';
import { copyOfficeAssets } from './copy-office-assets.js';

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const dist = path.join(pkgRoot, 'dist');
const webRoot = path.join(dist, 'web');

/** npm hoists bins to the monorepo root; look in both places. */
function findBin(name) {
  // On Windows npm bin stubs are .cmd files; the extensionless file is a
  // POSIX shell script that spawnSync cannot execute.
  const fileName = process.platform === 'win32' ? `${name}.cmd` : name;
  const candidates = [
    path.join(pkgRoot, 'node_modules', '.bin', fileName),
    path.resolve(pkgRoot, '..', '..', 'node_modules', '.bin', fileName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`binary not found: ${name}`);
}

function run(step, fn) {
  process.stdout.write(`[build] ${step}... `);
  const started = Date.now();
  const result = fn();
  const finish = () => console.log(`done (${Date.now() - started}ms)`);
  if (result && typeof result.then === 'function') {
    return result.then(finish);
  }
  finish();
  return Promise.resolve();
}

const skipTypecheck = process.argv.includes('--skip-typecheck');

if (!skipTypecheck) {
  await run('typecheck', () => {
    const tsc = findBin('tsc');
    // .cmd bin stubs on Windows must run through a shell (Node >=20.12
    // rejects spawning them directly).
    const spawnOpts = {
      cwd: pkgRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    };
    execFileSync(tsc, ['--noEmit', '-p', 'tsconfig.sidecar.json'], spawnOpts);
    execFileSync(tsc, ['--noEmit', '-p', 'tsconfig.taskpane.json'], spawnOpts);
  });
}

fs.rmSync(dist, { recursive: true, force: true });

await run('esbuild sidecar', () =>
  build({
    entryPoints: [path.join(pkgRoot, 'src', 'sidecar', 'index.ts')],
    outfile: path.join(dist, 'sidecar', 'index.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    sourcemap: false,
    logLevel: 'warning',
    // Optional native accelerators probed by `ws`; absent at runtime is fine.
    external: ['bufferutil', 'utf-8-validate'],
  }),
);

await run('copy deterministic report engine', () => {
  const source = fs.readFileSync(
    path.join(pkgRoot, 'src', 'sidecar', 'report-generator.ps1'),
  );
  // Windows PowerShell 5.1 treats BOM-less scripts as the active ANSI code
  // page. Prefix UTF-8 BOM so Korean labels and the 원신한 font survive.
  fs.writeFileSync(
    path.join(dist, 'sidecar', 'report-generator.ps1'),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), source]),
  );
});

await run('esbuild taskpane', () =>
  build({
    entryPoints: [path.join(pkgRoot, 'src', 'taskpane', 'index.ts')],
    outfile: path.join(webRoot, 'taskpane.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2015',
    sourcemap: false,
    logLevel: 'warning',
  }),
);

await run('esbuild polyfills', () =>
  build({
    entryPoints: [path.join(pkgRoot, 'src', 'taskpane', 'polyfills-entry.js')],
    outfile: path.join(webRoot, 'polyfills.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2015',
    sourcemap: false,
    logLevel: 'warning',
  }),
);

await run('downlevel to ES5 + es-check', async () => {
  const files = [
    path.join(webRoot, 'taskpane.js'),
    path.join(webRoot, 'polyfills.js'),
  ];
  for (const file of files) {
    await downlevelFile(file);
  }
  esCheck(files);
});

await run('copy static + office assets', () => {
  fs.copyFileSync(
    path.join(pkgRoot, 'src', 'taskpane', 'taskpane.html'),
    path.join(webRoot, 'taskpane.html'),
  );
  fs.copyFileSync(
    path.join(pkgRoot, 'src', 'taskpane', 'support.html'),
    path.join(webRoot, 'support.html'),
  );
  fs.copyFileSync(
    path.join(pkgRoot, 'src', 'taskpane', 'styles.css'),
    path.join(webRoot, 'styles.css'),
  );
  // Reuse the product icon set from the sibling Office add-in source. The
  // deploy output remains standalone and contains physical copies.
  const iconsDir = path.resolve(pkgRoot, '..', 'excel-addin', 'src', 'assets');
  for (const icon of fs.readdirSync(iconsDir)) {
    fs.mkdirSync(path.join(webRoot, 'assets'), { recursive: true });
    fs.copyFileSync(
      path.join(iconsDir, icon),
      path.join(webRoot, 'assets', icon),
    );
  }
  copyOfficeAssets(webRoot);
});

console.log(`[build] output: ${dist}`);
