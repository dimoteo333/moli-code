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
});
