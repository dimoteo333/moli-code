import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PORT, loadConfig } from '../src/sidecar/config.js';

describe('loadConfig', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  function writeConfig(content: string): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moli-config-test-'));
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, content);
    return configPath;
  }

  it('parses a config.json with a UTF-8 BOM (PowerShell 5.1 output)', () => {
    const configPath = writeConfig('\uFEFF{"port": 40001}');
    const config = loadConfig(configPath);
    expect(config.port).toBe(40001);
  });

  it('parses a config.json without a BOM', () => {
    const configPath = writeConfig('{"port": 40002}');
    expect(loadConfig(configPath).port).toBe(40002);
  });

  it('falls back to defaults when the file is missing', () => {
    const config = loadConfig(
      path.join(os.tmpdir(), 'moli-config-test-none', 'config.json'),
    );
    expect(config.port).toBe(DEFAULT_PORT);
  });

  it('defaults legacy configuration to the Standard edition', () => {
    const configPath = writeConfig('{}');

    expect(loadConfig(configPath)).toMatchObject({
      edition: 'standard',
      enabledGlobalTools: [],
      profileCatalogPath: undefined,
    });
  });

  it('loads explicit Global edition settings', () => {
    const configPath = writeConfig(
      JSON.stringify({
        edition: 'global',
        enabledGlobalTools: ['accounting-report'],
      }),
    );

    expect(loadConfig(configPath)).toMatchObject({
      edition: 'global',
      enabledGlobalTools: ['accounting-report'],
    });
  });

  it('rejects an unknown product edition', () => {
    const configPath = writeConfig(JSON.stringify({ edition: 'enterprise' }));

    expect(() => loadConfig(configPath)).toThrow();
  });

  it('rejects non-string Global tool IDs', () => {
    const configPath = writeConfig(
      JSON.stringify({ enabledGlobalTools: ['accounting-report', 42] }),
    );

    expect(() => loadConfig(configPath)).toThrow();
  });

  it('deduplicates Global tool IDs in their first-seen order', () => {
    const configPath = writeConfig(
      JSON.stringify({
        enabledGlobalTools: [
          'accounting-report',
          'financial-analysis',
          'accounting-report',
          'financial-analysis',
        ],
      }),
    );

    expect(loadConfig(configPath).enabledGlobalTools).toEqual([
      'accounting-report',
      'financial-analysis',
    ]);
  });

  it('resolves the profile catalog path relative to config.json', () => {
    const configPath = writeConfig(
      JSON.stringify({ profileCatalogPath: 'catalogs/global.json' }),
    );

    expect(loadConfig(configPath).profileCatalogPath).toBe(
      path.join(path.dirname(configPath), 'catalogs', 'global.json'),
    );
  });
});
