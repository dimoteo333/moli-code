/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { LspPostEditDiagnosticHook } from './LspPostEditDiagnosticHook.js';
import type { NativeLspService } from './NativeLspService.js';
import type { LspDiagnostic } from './types.js';

function createMockLspService(
  diagnosticsMap: Record<string, LspDiagnostic[]> = {},
): NativeLspService {
  return {
    notifyFileChanged: vi.fn(),
    diagnostics: vi.fn(async (uri: string) => diagnosticsMap[uri] ?? []),
  } as unknown as NativeLspService;
}

describe('LspPostEditDiagnosticHook', () => {
  it('returns null when no files are provided', async () => {
    const service = createMockLspService();
    const hook = new LspPostEditDiagnosticHook(service);

    const result = await hook.checkEditedFiles([]);
    expect(result).toBeNull();
  });

  it('returns null when no errors or warnings are found', async () => {
    const service = createMockLspService({});
    const hook = new LspPostEditDiagnosticHook(service);

    const result = await hook.checkEditedFiles(['/workspace/src/foo.cpp']);
    expect(result).toBeNull();
    expect(service.notifyFileChanged).toHaveBeenCalledWith(
      '/workspace/src/foo.cpp',
    );
  });

  it('formats errors and warnings correctly', async () => {
    const diagnostics: LspDiagnostic[] = [
      {
        range: {
          start: { line: 14, character: 2 },
          end: { line: 14, character: 5 },
        },
        severity: 'error',
        source: 'clangd',
        message: "use of undeclared identifier 'bar'",
      },
      {
        range: {
          start: { line: 21, character: 9 },
          end: { line: 21, character: 16 },
        },
        severity: 'warning',
        source: 'clangd',
        message: 'unused variable',
      },
      {
        range: {
          start: { line: 30, character: 0 },
          end: { line: 30, character: 1 },
        },
        severity: 'hint',
        source: 'clangd',
        message: 'consider using auto',
      },
    ];

    // The hook will call diagnostics with a file:// URI
    const service = createMockLspService();
    (service.diagnostics as ReturnType<typeof vi.fn>).mockResolvedValue(
      diagnostics,
    );
    const hook = new LspPostEditDiagnosticHook(service);

    const result = await hook.checkEditedFiles(['/workspace/src/foo.cpp']);
    expect(result).not.toBeNull();
    expect(result).toContain('[LSP Observation]');
    expect(result).toContain('1 error');
    expect(result).toContain('1 warning');
    expect(result).toContain('[ERROR] 15:3 (clangd)');
    expect(result).toContain('[WARNING] 22:10 (clangd)');
    // Hints should be filtered out
    expect(result).not.toContain('consider using auto');
  });

  it('deduplicates file paths', async () => {
    const service = createMockLspService();
    const hook = new LspPostEditDiagnosticHook(service);

    await hook.checkEditedFiles(['/workspace/a.cpp', '/workspace/a.cpp']);
    expect(service.notifyFileChanged).toHaveBeenCalledTimes(1);
  });

  it('limits to 5 files max', async () => {
    const service = createMockLspService();
    const hook = new LspPostEditDiagnosticHook(service);

    const files = Array.from({ length: 10 }, (_, i) => `/workspace/f${i}.cpp`);
    await hook.checkEditedFiles(files);
    expect(service.notifyFileChanged).toHaveBeenCalledTimes(5);
  });
});
