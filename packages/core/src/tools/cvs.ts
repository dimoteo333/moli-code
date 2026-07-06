/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ToolCallConfirmationDetails,
  ToolExecuteConfirmationDetails,
  ToolInvocation,
  ToolResult,
} from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolConfirmationOutcome,
} from './tools.js';
import { ToolErrorType } from './tool-error.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';
import type { Config } from '../config/config.js';
import type { CvsExecResult } from '../services/cvsService.js';
import { CvsService } from '../services/cvsService.js';

export type CvsOperation =
  | 'diff'
  | 'status'
  | 'update'
  | 'commit'
  | 'log'
  | 'add'
  | 'remove';

/** Operations that modify the workspace or the repository. */
const MUTATING_OPERATIONS: ReadonlySet<CvsOperation> = new Set([
  'update',
  'commit',
  'add',
  'remove',
]);

export interface CvsToolParams {
  /** Which CVS operation to perform. */
  operation: CvsOperation;
  /** Paths (relative to the project root) to operate on. Empty = whole tree. */
  paths?: string[];
  /** Commit message; required for the `commit` operation. */
  message?: string;
  /** Revision or tag, for `diff` (base), `update` (-r) and `log`. */
  revision?: string;
  /** Second revision or tag for `diff` (compare two revisions). */
  revision2?: string;
  /** For `update`: reset sticky tags/dates (-A). */
  clear_sticky_tags?: boolean;
}

function formatResult(result: CvsExecResult): string {
  const parts = [`$ ${result.command}`, ''];
  if (result.stdout.trim()) {
    parts.push(result.stdout.trimEnd());
  }
  if (result.stderr.trim()) {
    parts.push('--- stderr ---', result.stderr.trimEnd());
  }
  if (!result.stdout.trim() && !result.stderr.trim()) {
    parts.push('(no output)');
  }
  parts.push('', `exit code: ${result.exitCode}`);
  return parts.join('\n');
}

class CvsToolInvocation extends BaseToolInvocation<CvsToolParams, ToolResult> {
  constructor(
    private readonly config: Config,
    private readonly allowlist: Set<CvsOperation>,
    params: CvsToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const { operation, paths, message } = this.params;
    let description = `cvs ${operation}`;
    if (paths && paths.length > 0) {
      description += ` ${paths.join(' ')}`;
    }
    if (operation === 'commit' && message) {
      description += ` -m "${message.split('\n')[0]}"`;
    }
    return description;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    const operation = this.params.operation;
    if (!MUTATING_OPERATIONS.has(operation)) {
      return false; // read-only: diff / status / log
    }
    if (this.allowlist.has(operation)) {
      return false;
    }
    const confirmationDetails: ToolExecuteConfirmationDetails = {
      type: 'exec',
      title: 'Confirm CVS Operation',
      command: this.getDescription(),
      rootCommand: `cvs ${operation}`,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add(operation);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const service = new CvsService(this.config.getTargetDir());
    const { operation, paths = [] } = this.params;

    try {
      let result: CvsExecResult;
      switch (operation) {
        case 'diff':
          result = await service.diff(
            paths,
            {
              revision: this.params.revision,
              revision2: this.params.revision2,
            },
            signal,
          );
          if (!CvsService.isDiffSuccess(result)) {
            return this.errorResult(operation, result);
          }
          return this.successResult(result);
        case 'status':
          result = await service.status(paths, signal);
          break;
        case 'update':
          result = await service.update(
            paths,
            {
              revision: this.params.revision,
              clearStickyTags: this.params.clear_sticky_tags,
            },
            signal,
          );
          break;
        case 'commit':
          result = await service.commit(
            this.params.message ?? '',
            paths,
            signal,
          );
          break;
        case 'log':
          result = await service.log(
            paths,
            { revisionRange: this.params.revision },
            signal,
          );
          break;
        case 'add':
          result = await service.add(paths, signal);
          break;
        case 'remove':
          result = await service.remove(paths, signal);
          break;
        default: {
          const exhaustive: never = operation;
          throw new Error(`Unknown CVS operation: ${exhaustive}`);
        }
      }

      if (result.exitCode !== 0) {
        return this.errorResult(operation, result);
      }
      return this.successResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `CVS ${operation} failed: ${message}`,
        returnDisplay: `Error: ${message}`,
        error: { message, type: ToolErrorType.SHELL_EXECUTE_ERROR },
      };
    }
  }

  private successResult(result: CvsExecResult): ToolResult {
    const content = formatResult(result);
    return {
      llmContent: content,
      returnDisplay: content,
    };
  }

  private errorResult(
    operation: CvsOperation,
    result: CvsExecResult,
  ): ToolResult {
    const content = formatResult(result);
    return {
      llmContent: `CVS ${operation} failed (exit code ${result.exitCode}):\n${content}`,
      returnDisplay: content,
      error: {
        message: `cvs ${operation} exited with code ${result.exitCode}`,
        type: ToolErrorType.SHELL_EXECUTE_ERROR,
      },
    };
  }
}

/**
 * Tool exposing CVS (Concurrent Versions System) operations for legacy
 * projects — mainly Windows environments where source control is still CVS.
 * Read-only operations (diff, status, log) run without confirmation; anything
 * that writes to the workspace or the repository (update, commit, add,
 * remove) asks the user first.
 */
export class CvsTool extends BaseDeclarativeTool<CvsToolParams, ToolResult> {
  static readonly Name: string = ToolNames.CVS;
  private readonly allowlist = new Set<CvsOperation>();

  constructor(private readonly config: Config) {
    super(
      CvsTool.Name,
      ToolDisplayNames.CVS,
      'Interacts with a CVS (Concurrent Versions System) working copy. ' +
        'Supports: `diff` (show local changes, optionally between revisions), ' +
        '`status` (compact workspace state: M=modified, A=added, R=removed, C=conflict, U=needs update, ?=unknown), ' +
        '`update` (sync workspace with the repository), ' +
        '`commit` (commit changes; requires `message`), ' +
        '`log` (revision history), `add` and `remove` (schedule files). ' +
        'Use `status` and `diff` to inspect changes before asking the user to review a commit.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'diff',
              'status',
              'update',
              'commit',
              'log',
              'add',
              'remove',
            ],
            description: 'The CVS operation to perform.',
          },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Files or directories relative to the project root. Omit to operate on the entire working copy.',
          },
          message: {
            type: 'string',
            description: 'Commit message. Required for the `commit` operation.',
          },
          revision: {
            type: 'string',
            description:
              'Revision or tag: base revision for `diff`, target for `update` (-r), or range (e.g. "1.1:1.5") for `log`.',
          },
          revision2: {
            type: 'string',
            description:
              'Second revision or tag for `diff`, to compare two repository revisions.',
          },
          clear_sticky_tags: {
            type: 'boolean',
            description:
              'For `update`: reset sticky tags/dates back to the main trunk (-A).',
          },
        },
        required: ['operation'],
      },
    );
  }

  protected override validateToolParamValues(
    params: CvsToolParams,
  ): string | null {
    if (params.operation === 'commit' && !params.message?.trim()) {
      return 'The `commit` operation requires a non-empty `message`.';
    }
    if (
      (params.operation === 'add' || params.operation === 'remove') &&
      (!params.paths || params.paths.length === 0)
    ) {
      return `The \`${params.operation}\` operation requires at least one entry in \`paths\`.`;
    }
    for (const p of params.paths ?? []) {
      if (p.includes('..')) {
        return `Paths must stay within the project root: ${p}`;
      }
    }
    return null;
  }

  protected createInvocation(
    params: CvsToolParams,
  ): ToolInvocation<CvsToolParams, ToolResult> {
    return new CvsToolInvocation(this.config, this.allowlist, params);
  }
}
