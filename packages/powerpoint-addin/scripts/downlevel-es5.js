/**
 * Downlevel an esbuild (ES2015) bundle to ES5 with @swc/core, then verify
 * the output really is ES5 with es-check. esbuild cannot emit ES5 itself.
 *
 * Usage: node scripts/downlevel-es5.js <file.js> [more files...]
 */

import { transform } from '@swc/core';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export async function downlevelFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const result = await transform(source, {
    filename: path.basename(filePath),
    isModule: false,
    minify: false,
    sourceMaps: false,
    jsc: {
      parser: { syntax: 'ecmascript' },
      target: 'es5',
      loose: false,
      externalHelpers: false,
    },
  });
  fs.writeFileSync(filePath, result.code, 'utf8');
}

export function esCheck(files) {
  // On Windows npm bin stubs are .cmd files; the extensionless file is a
  // POSIX shell script that execFileSync cannot execute.
  const binName = process.platform === 'win32' ? 'es-check.cmd' : 'es-check';
  const candidates = [
    path.join(pkgRoot, 'node_modules', '.bin', binName),
    path.resolve(pkgRoot, '..', '..', 'node_modules', '.bin', binName),
  ];
  const esCheckBin = candidates.find((c) => fs.existsSync(c));
  if (!esCheckBin) {
    throw new Error('es-check binary not found');
  }
  // es-check treats file arguments as globs; backslashes in Windows paths
  // are glob escapes, so hand it forward-slash paths relative to pkgRoot.
  const globArgs = files.map((f) =>
    path.relative(pkgRoot, f).split(path.sep).join('/'),
  );
  execFileSync(esCheckBin, ['es5', ...globArgs], {
    stdio: 'inherit',
    cwd: pkgRoot,
    shell: process.platform === 'win32',
  });
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: node scripts/downlevel-es5.js <file.js> [...]');
    process.exit(1);
  }
  for (const file of files) {
    await downlevelFile(file);
  }
  esCheck(files);
  console.log(`downleveled to ES5: ${files.join(', ')}`);
}
