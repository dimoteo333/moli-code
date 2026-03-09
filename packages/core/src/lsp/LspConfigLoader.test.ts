/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, afterEach } from 'vitest';
import mock from 'mock-fs';
import { LspConfigLoader } from './LspConfigLoader.js';
import type { Extension } from '../extension/extensionManager.js';
import { pathToFileURL } from 'url';

describe('LspConfigLoader extension configs', () => {
  const workspaceRoot = '/workspace';
  const extensionPath = '/extensions/ts-plugin';

  afterEach(() => {
    mock.restore();
  });

  it('loads inline lspServers config from extension', async () => {
    const loader = new LspConfigLoader(workspaceRoot);
    const extension = {
      id: 'ts-plugin',
      name: 'ts-plugin',
      version: '1.0.0',
      isActive: true,
      path: extensionPath,
      contextFiles: [],
      config: {
        name: 'ts-plugin',
        version: '1.0.0',
        lspServers: {
          typescript: {
            command: 'typescript-language-server',
            args: ['--stdio'],
            extensionToLanguage: {
              '.ts': 'typescript',
            },
          },
        },
      },
    } as Extension;

    const configs = await loader.loadExtensionConfigs([extension]);

    expect(configs).toHaveLength(1);
    expect(configs[0]?.languages).toEqual(['typescript']);
    expect(configs[0]?.command).toBe('typescript-language-server');
    expect(configs[0]?.args).toEqual(['--stdio']);
  });

  it('loads lspServers config from referenced file and hydrates variables', async () => {
    mock({
      [extensionPath]: {
        '.lsp.json': JSON.stringify({
          typescript: {
            command: 'typescript-language-server',
            args: ['--stdio'],
            env: {
              EXT_ROOT: '${CLAUDE_PLUGIN_ROOT}',
            },
            extensionToLanguage: {
              '.ts': 'typescript',
            },
          },
        }),
      },
    });

    const loader = new LspConfigLoader(workspaceRoot);
    const extension = {
      id: 'ts-plugin',
      name: 'ts-plugin',
      version: '1.0.0',
      isActive: true,
      path: extensionPath,
      contextFiles: [],
      config: {
        name: 'ts-plugin',
        version: '1.0.0',
        lspServers: './.lsp.json',
      },
    } as Extension;

    const configs = await loader.loadExtensionConfigs([extension]);

    expect(configs).toHaveLength(1);
    expect(configs[0]?.env?.['EXT_ROOT']).toBe(extensionPath);
  });
});

describe('LspConfigLoader built-in presets', () => {
  const workspaceRoot = '/workspace';

  it('returns clangd preset when cpp is detected', () => {
    const loader = new LspConfigLoader(workspaceRoot);
    const configs = loader.mergeConfigs(['cpp'], [], []);

    const clangd = configs.find((c) => c.name === 'clangd');
    expect(clangd).toBeDefined();
    expect(clangd!.command).toBe('clangd');
    expect(clangd!.languages).toEqual(['cpp', 'c']);
    expect(clangd!.args).toEqual(['--background-index', '--clang-tidy']);
    expect(clangd!.transport).toBe('stdio');
    expect(clangd!.rootUri).toBe(pathToFileURL(workspaceRoot).toString());
  });

  it('returns clangd preset when c is detected', () => {
    const loader = new LspConfigLoader(workspaceRoot);
    const configs = loader.mergeConfigs(['c'], [], []);

    const clangd = configs.find((c) => c.name === 'clangd');
    expect(clangd).toBeDefined();
    expect(clangd!.languages).toEqual(['cpp', 'c']);
  });

  it('returns jdtls preset when java is detected', () => {
    const loader = new LspConfigLoader(workspaceRoot);
    const configs = loader.mergeConfigs(['java'], [], []);

    const jdtls = configs.find((c) => c.name === 'jdtls');
    expect(jdtls).toBeDefined();
    expect(jdtls!.command).toBe('jdtls');
    expect(jdtls!.languages).toEqual(['java']);
    expect(jdtls!.startupTimeout).toBe(30000);
    expect(jdtls!.maxRestarts).toBe(2);
    expect(jdtls!.transport).toBe('stdio');
  });

  it('does not return clangd/jdtls when those languages are not detected', () => {
    const loader = new LspConfigLoader(workspaceRoot);
    const configs = loader.mergeConfigs(['typescript'], [], []);

    expect(configs.find((c) => c.name === 'clangd')).toBeUndefined();
    expect(configs.find((c) => c.name === 'jdtls')).toBeUndefined();
  });
});
