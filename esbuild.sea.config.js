/**
 * esbuild config for Node.js SEA (Single Executable Application)
 * Produces an ESM bundle, then wraps it as a self-executing CJS script for SEA.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';

let esbuild;
try {
  esbuild = (await import('esbuild')).default;
} catch (_error) {
  console.warn('esbuild not available, skipping SEA bundle step');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

const seaDistDir = path.resolve(__dirname, 'dist-sea');

// Clean dist-sea directory
rmSync(seaDistDir, { recursive: true, force: true });
mkdirSync(seaDistDir, { recursive: true });

const external = [
  '@lydell/node-pty',
  'node-pty',
  '@lydell/node-pty-darwin-arm64',
  '@lydell/node-pty-darwin-x64',
  '@lydell/node-pty-linux-x64',
  '@lydell/node-pty-win32-arm64',
  '@lydell/node-pty-win32-x64',
  '@teddyzhu/clipboard',
  '@teddyzhu/clipboard-darwin-arm64',
  '@teddyzhu/clipboard-darwin-x64',
  '@teddyzhu/clipboard-linux-x64-gnu',
  '@teddyzhu/clipboard-linux-arm64-gnu',
  '@teddyzhu/clipboard-win32-x64-msvc',
  '@teddyzhu/clipboard-win32-arm64-msvc',
];

// Step 1: Build ESM bundle (supports top-level await from ink/yoga-layout)
await esbuild.build({
  entryPoints: ['packages/cli/index.ts'],
  bundle: true,
  outfile: 'dist-sea/cli.mjs',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external,
  packages: 'bundle',
  inject: [path.resolve(__dirname, 'scripts/esbuild-shims.js')],
  alias: {
    'is-in-ci': path.resolve(__dirname, 'packages/cli/src/patches/is-in-ci.ts'),
  },
  define: {
    'process.env.CLI_VERSION': JSON.stringify(pkg.version),
    global: 'globalThis',
  },
  loader: { '.node': 'file' },
  metafile: true,
  write: true,
  keepNames: true,
});

// Step 2: Wrap the ESM bundle into a CJS-compatible script for SEA
// SEA evaluates scripts as CJS, so we wrap in an async IIFE and
// replace ESM-only constructs.
let esmCode = readFileSync('dist-sea/cli.mjs', 'utf8');

// Remove shebang (not needed in SEA)
esmCode = esmCode.replace(/^#!.*\n/, '');

// Replace all import.meta.url with CJS equivalent
// In SEA, __filename points to the executable; we use process.execPath for SEA detection
// and provide a file:// URL that resolves to the exe's directory for asset lookups.
esmCode = esmCode.replace(
  /\bimport\.meta\.url\b/g,
  'require("url").pathToFileURL(process.execPath).href',
);
esmCode = esmCode.replace(/\bimport\.meta\.dirname\b/g, '__dirname');
esmCode = esmCode.replace(/\bimport\.meta\.filename\b/g, '__filename');

// Convert ALL top-level ESM imports to CJS requires
// Match both "node:xxx" prefixed and bare Node.js builtin modules
const modPattern = '[^"]+'; // Match any module specifier

// Pattern: import X from "xxx";
esmCode = esmCode.replace(
  new RegExp(`^import\\s+(\\w+)\\s+from\\s+"(${modPattern})";$`, 'gm'),
  'const $1 = require("$2");',
);
// Pattern: import { X, Y as Z } from "xxx";
esmCode = esmCode.replace(
  new RegExp(`^import\\s+\\{([^}]+)\\}\\s+from\\s+"(${modPattern})";$`, 'gm'),
  (_, imports, mod) => {
    const fixed = imports.replace(/\b(\w+)\s+as\s+(\w+)\b/g, '$1: $2');
    return `const {${fixed}} = require("${mod}");`;
  },
);
// Pattern: import * as X from "xxx";
esmCode = esmCode.replace(
  new RegExp(
    `^import\\s+\\*\\s+as\\s+(\\w+)\\s+from\\s+"(${modPattern})";$`,
    'gm',
  ),
  'const $1 = require("$2");',
);
// Pattern: import X, { Y as Z } from "xxx";
esmCode = esmCode.replace(
  new RegExp(
    `^import\\s+(\\w+),\\s*\\{([^}]+)\\}\\s+from\\s+"(${modPattern})";$`,
    'gm',
  ),
  (_, def, imports, mod) => {
    const fixed = imports.replace(/\b(\w+)\s+as\s+(\w+)\b/g, '$1: $2');
    return `const ${def} = require("${mod}"); const {${fixed}} = ${def};`;
  },
);

// Wrap the entire code in an async IIFE to support top-level await
const wrappedCode = `// Node.js SEA bundle for moli-code
"use strict";
(async () => {
${esmCode}
})().catch(err => { console.error(err); process.exit(1); });
`;

writeFileSync('dist-sea/cli.cjs', wrappedCode);

// Clean up intermediate ESM file
rmSync('dist-sea/cli.mjs');

const sizeBytes = Buffer.byteLength(wrappedCode);
console.log(
  `SEA bundle created: dist-sea/cli.cjs (${(sizeBytes / 1024 / 1024).toFixed(1)}MB)`,
);
