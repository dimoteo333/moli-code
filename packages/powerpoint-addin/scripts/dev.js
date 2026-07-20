/**
 * Dev loop (macOS/Linux): generate a self-signed localhost cert (PEM) if
 * missing, write a dev config, and run the sidecar with console mirroring.
 *
 * The moli CLI is resolved via MOLI_CODE_CLI_PATH if set, else the repo's
 * bundled dist/cli.js if present, else the SDK's own resolution.
 *
 *   npm run dev            (expects a prior `npm run build`)
 *   npm run dev -- --build (build first)
 */

import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const dist = path.join(pkgRoot, 'dist');
const certsDir = path.join(pkgRoot, 'certs');

if (
  process.argv.includes('--build') ||
  !fs.existsSync(path.join(dist, 'sidecar', 'index.cjs'))
) {
  execFileSync(process.execPath, [path.join(pkgRoot, 'scripts', 'build.js')], {
    cwd: pkgRoot,
    stdio: 'inherit',
  });
}

const certPath = path.join(certsDir, 'dev-cert.pem');
const keyPath = path.join(certsDir, 'dev-key.pem');
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  const { generate } = await import('selfsigned');
  const pems = generate([{ name: 'commonName', value: 'localhost' }], {
    days: 825,
    keySize: 2048,
    extensions: [
      { name: 'basicConstraints', cA: false },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  });
  fs.mkdirSync(certsDir, { recursive: true });
  fs.writeFileSync(certPath, pems.cert, 'utf8');
  fs.writeFileSync(keyPath, pems.private, 'utf8');
  console.log(`generated dev cert: ${certPath}`);
}

// Default the CLI to the repo bundle when available.
const repoCli = path.resolve(pkgRoot, '..', '..', 'dist', 'cli.js');
const cliPath =
  process.env.MOLI_CODE_CLI_PATH ??
  (fs.existsSync(repoCli) ? repoCli : undefined);

const configPath = path.join(dist, 'dev-config.json');
fs.writeFileSync(
  configPath,
  JSON.stringify(
    {
      port: 39216,
      certPemCertPath: certPath,
      certPemKeyPath: keyPath,
      cliPath,
      workDir: path.join(dist, 'dev-workspace'),
      logLevel: 'debug',
    },
    null,
    2,
  ),
  'utf8',
);

const extraArgs = process.argv.includes('--http') ? ['--insecure-http'] : [];
const child = spawn(
  process.execPath,
  [
    path.join(dist, 'sidecar', 'index.cjs'),
    '--config',
    configPath,
    '--dev',
    ...extraArgs,
  ],
  { cwd: pkgRoot, stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 0));
