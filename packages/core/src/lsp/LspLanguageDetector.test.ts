/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, afterEach } from 'vitest';
import mock from 'mock-fs';
import { LspLanguageDetector } from './LspLanguageDetector.js';
import type { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import type { WorkspaceContext } from '../utils/workspaceContext.js';

function createMockWorkspaceContext(dirs: string[]): WorkspaceContext {
  return {
    getDirectories: () => dirs,
    isPathWithinWorkspace: () => true,
  } as unknown as WorkspaceContext;
}

function createMockFileDiscoveryService(): FileDiscoveryService {
  return {
    shouldIgnoreFile: () => false,
  } as unknown as FileDiscoveryService;
}

describe('LspLanguageDetector', () => {
  afterEach(() => {
    mock.restore();
  });

  it('detects .h files as c language', async () => {
    mock({
      '/workspace': {
        'main.h': '#include <stdio.h>',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('c');
  });

  it('detects .hpp/.cc/.cxx files as cpp language', async () => {
    mock({
      '/workspace': {
        'lib.hpp': '',
        'main.cc': '',
        'util.cxx': '',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('cpp');
  });

  it('detects CMakeLists.txt as cpp marker', async () => {
    mock({
      '/workspace': {
        'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.10)',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('cpp');
  });

  it('detects compile_commands.json as cpp marker', async () => {
    mock({
      '/workspace': {
        'compile_commands.json': '[]',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('cpp');
  });

  it('detects .clangd as cpp marker', async () => {
    mock({
      '/workspace': {
        '.clangd': 'CompileFlags:\n  Add: [-std=c++17]',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('cpp');
  });

  it('detects build.gradle.kts as java marker', async () => {
    mock({
      '/workspace': {
        'build.gradle.kts': 'plugins { java }',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('java');
  });

  it('detects settings.gradle as java marker', async () => {
    mock({
      '/workspace': {
        'settings.gradle': 'rootProject.name = "test"',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('java');
  });

  it('detects .classpath as java marker', async () => {
    mock({
      '/workspace': {
        '.classpath': '<classpath/>',
      },
    });

    const detector = new LspLanguageDetector(
      createMockWorkspaceContext(['/workspace']),
      createMockFileDiscoveryService(),
    );

    const languages = await detector.detectLanguages();
    expect(languages).toContain('java');
  });
});
