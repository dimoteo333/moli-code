import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PORT, loadConfig } from '../src/sidecar/config.js';

describe('loadConfig', () => {
  let tmpDir: string | undefined;
  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses PowerShell 5.1 UTF-8 BOM output', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moli-ppt-config-'));
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, '\uFEFF{"port":40016}');
    expect(loadConfig(configPath).port).toBe(40016);
  });

  it('uses a port distinct from the Excel sidecar by default', () => {
    expect(DEFAULT_PORT).toBe(39216);
  });
});
