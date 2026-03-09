/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Post-edit diagnostic hook that bridges agent file edits to LSP diagnostic
 * feedback. After the agent writes or edits files, this hook notifies the
 * relevant LSP servers of the changes, waits briefly for diagnostics to
 * arrive, and formats any errors/warnings into agent-readable text.
 */

import * as path from 'path';
import { pathToFileURL } from 'url';
import type { NativeLspService } from './NativeLspService.js';
import type { LspDiagnostic } from './types.js';

const POST_EDIT_DIAGNOSTIC_DELAY_MS = 200;
const MAX_FILES_PER_CHECK = 5;

interface PostEditDiagnosticResult {
  filePath: string;
  diagnostics: LspDiagnostic[];
}

export class LspPostEditDiagnosticHook {
  constructor(private readonly lspService: NativeLspService) {}

  /**
   * Check diagnostics for recently edited files.
   *
   * Notifies LSP servers of file changes, waits for them to process,
   * then retrieves and formats diagnostics (errors and warnings only).
   *
   * @param filePaths - Absolute or workspace-relative paths of edited files
   * @returns Formatted diagnostic summary, or null if no errors/warnings found
   */
  async checkEditedFiles(filePaths: string[]): Promise<string | null> {
    // Deduplicate and limit
    const uniquePaths = [...new Set(filePaths)].slice(0, MAX_FILES_PER_CHECK);
    if (uniquePaths.length === 0) {
      return null;
    }

    // Notify LSP servers of each changed file
    for (const filePath of uniquePaths) {
      await this.lspService.notifyFileChanged(filePath);
    }

    // Allow LSP servers time to process changes
    await new Promise((resolve) =>
      setTimeout(resolve, POST_EDIT_DIAGNOSTIC_DELAY_MS),
    );

    // Collect diagnostics for each file
    const results: PostEditDiagnosticResult[] = [];
    for (const filePath of uniquePaths) {
      const absolutePath = path.isAbsolute(filePath) ? filePath : filePath;
      const uri = pathToFileURL(absolutePath).toString();
      try {
        const diagnostics = await this.lspService.diagnostics(uri);
        // Filter to errors and warnings only
        const significant = diagnostics.filter(
          (d) => d.severity === 'error' || d.severity === 'warning',
        );
        if (significant.length > 0) {
          results.push({ filePath, diagnostics: significant });
        }
      } catch {
        // Ignore diagnostic fetch failures
      }
    }

    return this.formatDiagnostics(results);
  }

  /**
   * Format diagnostic results into agent-readable observation text.
   *
   * @returns Formatted string, or null if no diagnostics to report
   */
  private formatDiagnostics(
    results: PostEditDiagnosticResult[],
  ): string | null {
    if (results.length === 0) {
      return null;
    }

    const lines: string[] = [
      '[LSP Observation] Diagnostics after your edits:',
    ];

    for (const result of results) {
      const errorCount = result.diagnostics.filter(
        (d) => d.severity === 'error',
      ).length;
      const warningCount = result.diagnostics.filter(
        (d) => d.severity === 'warning',
      ).length;

      const counts: string[] = [];
      if (errorCount > 0) {
        counts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
      }
      if (warningCount > 0) {
        counts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
      }

      lines.push(`${result.filePath}: ${counts.join(', ')}`);

      for (const diag of result.diagnostics) {
        const severity = (diag.severity ?? 'error').toUpperCase();
        const line = diag.range.start.line + 1;
        const character = diag.range.start.character + 1;
        const source = diag.source ? ` (${diag.source})` : '';
        lines.push(
          `  [${severity}] ${line}:${character}${source}: ${diag.message}`,
        );
      }
    }

    return lines.join('\n');
  }
}
