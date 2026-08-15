import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS_DIR = path.join(PACKAGE_ROOT, 'src', 'assets');
const GENERATOR_PATH = path.join(
  PACKAGE_ROOT,
  'scripts',
  'generate-global-icons.ps1',
);
const DEPLOY_DIR = path.join(PACKAGE_ROOT, 'deploy');
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
).version as string;
const OFFLINE_ZIP = path.join(
  PACKAGE_ROOT,
  `moli-excel-addin-${packageVersion}-offline.zip`,
);

const EXPECTED_ASSETS: Record<string, { width: number; height: number }> = {
  'global-icon-master.png': { width: 320, height: 320 },
  'global-icon-16.png': { width: 16, height: 16 },
  'global-icon-32.png': { width: 32, height: 32 },
  'global-icon-64.png': { width: 64, height: 64 },
  'global-icon-80.png': { width: 80, height: 80 },
  'global-ribbon-16.png': { width: 16, height: 16 },
  'global-ribbon-32.png': { width: 32, height: 32 },
  'global-ribbon-80.png': { width: 80, height: 80 },
};

function readPngSize(
  fileName: string,
  directory = ASSETS_DIR,
): {
  width: number;
  height: number;
} {
  const bytes = fs.readFileSync(path.join(directory, fileName));
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('Global branding assets', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(Object.entries(EXPECTED_ASSETS))(
    'commits %s with its required PNG dimensions',
    (fileName, dimensions) => {
      expect(readPngSize(fileName)).toEqual(dimensions);
    },
  );

  it('reproduces the committed Global PNG family from the Standard source', () => {
    const outputDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'moli-global-assets-'),
    );
    temporaryDirectories.push(outputDirectory);
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        GENERATOR_PATH,
        '-SourcePath',
        path.join(ASSETS_DIR, 'icon-80.png'),
        '-OutputDirectory',
        outputDirectory,
      ],
      { encoding: 'utf8' },
    );

    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    for (const [fileName, dimensions] of Object.entries(EXPECTED_ASSETS)) {
      expect(readPngSize(fileName, outputDirectory)).toEqual(dimensions);
      expect(fs.readFileSync(path.join(outputDirectory, fileName))).toEqual(
        fs.readFileSync(path.join(ASSETS_DIR, fileName)),
      );
    }
    expect(
      fs.readFileSync(path.join(outputDirectory, 'global-icon-80.png')),
    ).not.toEqual(fs.readFileSync(path.join(ASSETS_DIR, 'icon-80.png')));
  });
});

describe('offline deployment assembly', () => {
  afterEach(() => {
    fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
  });

  it('copies profiles and both icon families without creating an archive', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/package-deploy.js', '--skip-node', '--no-archive'],
      { cwd: PACKAGE_ROOT, encoding: 'utf8' },
    );

    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(
      fs.existsSync(path.join(DEPLOY_DIR, 'profiles', 'product-profiles.json')),
    ).toBe(true);
    for (const fileName of [
      'icon-16.png',
      'icon-32.png',
      'icon-64.png',
      'icon-80.png',
      'ribbon-16.png',
      'ribbon-32.png',
      'ribbon-80.png',
      ...Object.keys(EXPECTED_ASSETS).filter(
        (fileName) => fileName !== 'global-icon-master.png',
      ),
    ]) {
      expect(
        fs.existsSync(path.join(DEPLOY_DIR, 'web', 'assets', fileName)),
      ).toBe(true);
    }
    expect(fs.existsSync(OFFLINE_ZIP)).toBe(false);
  });
});
