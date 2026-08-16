/**
 * PaneSession: bridges one task-pane WebSocket to one multi-turn moli-code
 * agent session.
 *
 * - user_message frames are pushed into the query's streaming input
 * - SDK output messages are translated to pane frames (deltas, tool chips)
 * - canUseTool round-trips to the pane's permission modal
 * - Excel MCP tool handlers round-trip through RpcManager / excel_exec
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import type { WebSocket } from 'ws';
import {
  query,
  type Query,
  type QueryOptions,
  type SDKMessage,
  type SDKUserMessage,
  type PermissionResult,
} from '@dobby/moli-code-sdk';
import {
  PROTOCOL_VERSION,
  serializeFrame,
  type AnyFrame,
  type HelloFrame,
  type PaneToSidecarFrame,
  type SidecarToPaneFrame,
  type PaneContentBlock,
  type PerformanceEventName,
} from '../shared/messages.js';
import type { SidecarConfig } from './config.js';
import { RpcManager } from './rpc.js';
import {
  buildExcelMcpServer,
  isReadOnlyExcelTool,
  excelToolBaseName,
} from './excel-mcp.js';
import type { Logger } from './logger.js';
import {
  loadProductProfileCatalog,
  ProductProfileError,
  resolveEnabledGlobalAgents,
} from './product-profiles.js';

export interface SessionEnv {
  port: number;
  version: string;
  config: SidecarConfig;
}

const PERMISSION_TIMEOUT_MS = 300_000;
const MCP_REQUEST_TIMEOUT_MS = 120_000;
const INPUT_PREVIEW_MAX_CHARS = 2_000;

/** Unbounded async push queue feeding the SDK's streaming-input iterable. */
class PushQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: Array<(r: IteratorResult<T>) => void> = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) {
      return;
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  end(): void {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        const item = this.items.shift();
        if (item !== undefined) {
          return Promise.resolve({ value: item, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

interface PermissionDecision {
  allowed: boolean;
  message?: string;
}

interface PendingPermission {
  settle: (decision: PermissionDecision) => void;
  toolName: string;
}

type ProductProfileResolution =
  | { agents: NonNullable<QueryOptions['agents']> }
  | { error: ProductProfileError };

export class PaneSession {
  private readonly sessionId = randomUUID();
  private readonly rpc: RpcManager;
  private readonly inputQueue = new PushQueue<SDKUserMessage>();
  private readonly abortController = new AbortController();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly sessionAllowedTools = new Set<string>();
  private readonly toolUseNames = new Map<string, string>();
  private queryInstance: Query | null = null;
  private permissionSeq = 0;
  private turnId = 0;
  private firstDeltaTurn = 0;
  private disposed = false;
  private productProfileResolution: ProductProfileResolution | null = null;
  private readonly sessionStartedAt = performance.now();

  constructor(
    private readonly ws: WebSocket,
    private readonly hello: HelloFrame,
    private readonly env: SessionEnv,
    private readonly logger: Logger,
  ) {
    this.rpc = new RpcManager(
      (frame) => this.send(frame),
      MCP_REQUEST_TIMEOUT_MS - 10_000,
    );
    logger.info(
      `Pane session ${this.sessionId} started (host=${hello.host ?? '?'} platform=${hello.platform ?? '?'} sets=${JSON.stringify(hello.requirementSets)})`,
    );
    this.prewarmQuery();
  }

  private prewarmQuery(): void {
    try {
      const q = this.ensureQuery();
      void q.initialized.then(
        () => {
          this.emitPerformance('cli_initialized');
          this.sendHello();
        },
        (err) => {
          if (this.queryInstance === q) {
            this.queryInstance = null;
          }
          if (this.reportProductProfileFailure(err)) {
            this.emitPerformance(
              'query_prewarm_failed',
              undefined,
              String(err),
            );
            this.sendHello();
            return;
          }
          this.logger.warn(`Agent session prewarm failed: ${String(err)}`);
          this.emitPerformance('query_prewarm_failed', undefined, String(err));
          this.sendHello();
        },
      );
    } catch (err) {
      if (this.reportProductProfileFailure(err)) {
        this.emitPerformance('query_prewarm_failed', undefined, String(err));
        this.sendHello();
        return;
      }
      this.logger.warn(`Agent session prewarm failed: ${String(err)}`);
      this.emitPerformance('query_prewarm_failed', undefined, String(err));
      this.sendHello();
    }
  }

  private sendHello(): void {
    this.send({
      v: PROTOCOL_VERSION,
      type: 'hello_ok',
      sessionId: this.sessionId,
      version: this.env.version,
      model: this.env.config.model,
    });
  }

  onFrame(frame: PaneToSidecarFrame | AnyFrame): void {
    switch (frame.type) {
      case 'user_message':
        this.handleUserMessage(frame.text);
        break;
      case 'permission_response': {
        const pending = this.pendingPermissions.get(frame.id);
        if (!pending) {
          return;
        }
        // settle() removes the map entry itself (dedup vs abort/dispose).
        if (frame.behavior === 'allow') {
          if (frame.alwaysAllow) {
            const baseName = excelToolBaseName(pending.toolName);
            this.sessionAllowedTools.add(baseName);
            // Requests for the same tool queued behind this one were created
            // before the always-allow registered — settle them too so the
            // pane doesn't keep prompting.
            for (const other of Array.from(this.pendingPermissions.values())) {
              if (
                other !== pending &&
                excelToolBaseName(other.toolName) === baseName
              ) {
                other.settle({ allowed: true });
              }
            }
          }
          pending.settle({ allowed: true });
        } else {
          pending.settle({
            allowed: false,
            message: frame.message ?? '사용자가 이 작업을 거부했습니다.',
          });
        }
        break;
      }
      case 'excel_result':
        this.rpc.handleResult(frame);
        break;
      case 'interrupt':
        this.queryInstance?.interrupt().catch((err) => {
          this.logger.error('interrupt failed', err);
        });
        break;
      case 'ping':
        this.send({ v: PROTOCOL_VERSION, type: 'pong' });
        break;
      default:
        this.logger.warn(`Unexpected frame from pane: ${frame.type}`);
    }
  }

  dispose(reason: string): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.logger.info(`Disposing session ${this.sessionId}: ${reason}`);
    this.inputQueue.end();
    this.rpc.rejectAll(reason);
    for (const pending of Array.from(this.pendingPermissions.values())) {
      pending.settle({ allowed: false, message: reason });
    }
    this.pendingPermissions.clear();
    this.abortController.abort();
  }

  private handleUserMessage(text: string): void {
    if (!text || !text.trim()) {
      return;
    }
    const turnId = ++this.turnId;
    let q: Query;
    try {
      q = this.ensureQuery();
    } catch (err) {
      if (this.reportProductProfileFailure(err, turnId)) {
        return;
      }
      this.reportAgentStartFailure(turnId, err);
      return;
    }
    this.enqueueAfterInitialization(q, text, turnId, true);
  }

  private enqueueAfterInitialization(
    q: Query,
    text: string,
    turnId: number,
    retryOnFailure: boolean,
  ): void {
    void q.initialized.then(
      () => {
        if (this.disposed) {
          return;
        }
        this.inputQueue.push({
          type: 'user',
          session_id: this.sessionId,
          message: { role: 'user', content: text },
          parent_tool_use_id: null,
        });
        this.emitPerformance('user_message_enqueued', turnId);
      },
      (err) => {
        if (this.queryInstance === q) {
          this.queryInstance = null;
        }
        if (this.disposed) {
          return;
        }
        if (retryOnFailure) {
          try {
            const replacement = this.ensureQuery();
            this.enqueueAfterInitialization(replacement, text, turnId, false);
          } catch (replacementErr) {
            if (this.reportProductProfileFailure(replacementErr, turnId)) {
              return;
            }
            this.reportAgentStartFailure(turnId, replacementErr);
          }
          return;
        }
        if (this.reportProductProfileFailure(err, turnId)) {
          return;
        }
        this.reportAgentStartFailure(turnId, err);
      },
    );
  }

  private reportAgentStartFailure(turnId: number, err: unknown): void {
    // e.g. CLI executable not found — report instead of crashing.
    this.logger.error('Failed to start agent session', err);
    this.send({
      v: PROTOCOL_VERSION,
      type: 'error',
      code: 'AGENT_START_FAILED',
      messageKo:
        '에이전트를 시작할 수 없습니다. 몰리 CLI 설치 상태를 확인해 주세요. (로그: logs/sidecar.log)',
    });
    this.send({
      v: PROTOCOL_VERSION,
      type: 'turn_complete',
      turnId,
      isError: true,
      errorMessage: '에이전트 시작 실패',
    });
  }

  private reportProductProfileFailure(err: unknown, turnId?: number): boolean {
    if (!(err instanceof ProductProfileError)) {
      return false;
    }
    this.logger.error('Invalid product profile', err);
    this.send({
      v: PROTOCOL_VERSION,
      type: 'error',
      code: 'PRODUCT_PROFILE_INVALID',
      messageKo: `제품 프로필 구성이 올바르지 않습니다. ${err.message}`,
    });
    if (turnId !== undefined) {
      this.send({
        v: PROTOCOL_VERSION,
        type: 'turn_complete',
        turnId,
        isError: true,
        errorMessage: '제품 프로필 구성 오류',
      });
    }
    return true;
  }

  private resolveProductProfileAgents(): NonNullable<QueryOptions['agents']> {
    if (this.productProfileResolution) {
      if ('error' in this.productProfileResolution) {
        throw this.productProfileResolution.error;
      }
      return this.productProfileResolution.agents;
    }

    const { edition, enabledGlobalTools, profileCatalogPath } = this.env.config;
    try {
      let agents: NonNullable<QueryOptions['agents']>;
      if (!profileCatalogPath) {
        if (edition !== 'standard' || enabledGlobalTools.length > 0) {
          throw new ProductProfileError(
            'A product profile catalog path is required for Global tools.',
          );
        }
        agents = [];
      } else {
        const catalog = loadProductProfileCatalog(profileCatalogPath);
        agents = resolveEnabledGlobalAgents(catalog, {
          edition,
          enabledGlobalTools,
        });
      }
      this.productProfileResolution = { agents };
      return agents;
    } catch (err) {
      if (err instanceof ProductProfileError) {
        this.productProfileResolution = { error: err };
      }
      throw err;
    }
  }

  private ensureQuery(): Query {
    if (this.queryInstance) {
      return this.queryInstance;
    }
    const config = this.env.config;
    const agents = this.resolveProductProfileAgents();
    fs.mkdirSync(config.workDir, { recursive: true });

    const options: QueryOptions = {
      cwd: config.workDir,
      pathToMoliExecutable: config.cliPath,
      model: config.model,
      permissionMode: 'default',
      excludeTools: config.excludeTools,
      ...(agents.length > 0 ? { agents } : {}),
      includePartialMessages: true,
      sessionId: this.sessionId,
      abortController: this.abortController,
      canUseTool: (toolName, input, { signal }) =>
        this.handleCanUseTool(toolName, input, signal),
      mcpServers: {
        excel: buildExcelMcpServer(
          this.rpc,
          (toolName, input) => this.requestPanePermission(toolName, input),
          this.hello.requirementSets,
        ),
      },
      timeout: {
        canUseTool: PERMISSION_TIMEOUT_MS,
        mcpRequest: MCP_REQUEST_TIMEOUT_MS,
      },
      stderr: (message) => this.logger.debug(`cli stderr: ${message}`),
    };

    this.logger.info(
      `Starting agent session ${this.sessionId} (cli=${config.cliPath ?? '<auto>'} cwd=${config.workDir})`,
    );
    this.emitPerformance('query_spawn_started');
    this.queryInstance = query({ prompt: this.inputQueue, options });
    void this.pumpMessages(this.queryInstance);
    return this.queryInstance;
  }

  private async pumpMessages(q: Query): Promise<void> {
    try {
      for await (const message of q) {
        this.handleSdkMessage(message);
      }
    } catch (err) {
      if (!this.disposed) {
        this.logger.error('SDK message pump failed', err);
        this.send({
          v: PROTOCOL_VERSION,
          type: 'error',
          code: 'AGENT_ERROR',
          messageKo:
            '에이전트 세션이 종료되었습니다. 작업창을 새로고침해 주세요.',
        });
      }
    }
  }

  private handleSdkMessage(message: SDKMessage): void {
    switch (message.type) {
      case 'stream_event': {
        if (message.parent_tool_use_id) {
          return; // subagent output — don't stream into the chat
        }
        const event = message.event;
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          if (this.firstDeltaTurn !== this.turnId) {
            this.firstDeltaTurn = this.turnId;
            this.emitPerformance('first_delta_received', this.turnId);
          }
          this.send({
            v: PROTOCOL_VERSION,
            type: 'assistant_delta',
            turnId: this.turnId,
            text: event.delta.text,
          });
        } else if (
          event.type === 'content_block_delta' &&
          (event.delta as { type?: string }).type === 'thinking_delta'
        ) {
          const thinking = (event.delta as { thinking?: string }).thinking;
          if (thinking) {
            this.send({
              v: PROTOCOL_VERSION,
              type: 'thinking',
              turnId: this.turnId,
              text: thinking,
            });
          }
        }
        break;
      }
      case 'assistant': {
        if (message.parent_tool_use_id) {
          return;
        }
        const blocks: PaneContentBlock[] = [];
        for (const block of message.message.content) {
          if (block.type === 'text') {
            blocks.push({ type: 'text', text: block.text });
          } else if (block.type === 'tool_use') {
            this.toolUseNames.set(block.id, block.name);
            this.send({
              v: PROTOCOL_VERSION,
              type: 'tool_activity',
              turnId: this.turnId,
              toolName: block.name,
              status: 'start',
              summary: previewJson(block.input),
            });
          }
        }
        if (blocks.length > 0) {
          this.send({
            v: PROTOCOL_VERSION,
            type: 'assistant_message',
            turnId: this.turnId,
            blocks,
          });
        }
        break;
      }
      case 'user': {
        // CLI echoes tool results back as user messages.
        const content = message.message.content;
        if (typeof content === 'string') {
          return;
        }
        for (const block of content) {
          if (block.type === 'tool_result') {
            const toolName = this.toolUseNames.get(block.tool_use_id) ?? 'tool';
            this.toolUseNames.delete(block.tool_use_id);
            this.send({
              v: PROTOCOL_VERSION,
              type: 'tool_activity',
              turnId: this.turnId,
              toolName,
              status: 'end',
              isError: block.is_error === true,
            });
          }
        }
        break;
      }
      case 'result': {
        this.send({
          v: PROTOCOL_VERSION,
          type: 'turn_complete',
          turnId: this.turnId,
          isError: message.is_error,
          errorMessage: message.is_error
            ? ((message as { error?: { message?: string } }).error?.message ??
              '요청 처리 중 오류가 발생했습니다.')
            : undefined,
        });
        break;
      }
      case 'system':
        this.logger.debug(`system message: ${message.subtype}`);
        break;
      default:
        break;
    }
  }

  /**
   * User approval round-trip to the pane modal. Shared by the MCP write
   * gate (gatedExec) and by canUseTool for the CLI's native tools.
   */
  private requestPanePermission(
    toolName: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<PermissionDecision> {
    const baseName = excelToolBaseName(toolName);
    if (
      isReadOnlyExcelTool(baseName) ||
      this.sessionAllowedTools.has(baseName)
    ) {
      return Promise.resolve({ allowed: true });
    }

    const id = `perm-${++this.permissionSeq}`;
    return new Promise<PermissionDecision>((resolve) => {
      const settle = (decision: PermissionDecision): void => {
        if (this.pendingPermissions.delete(id)) {
          resolve(decision);
        }
      };
      this.pendingPermissions.set(id, { toolName, settle });
      signal?.addEventListener('abort', () => {
        settle({ allowed: false, message: '요청이 취소되었습니다.' });
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'permission_request',
        id,
        toolName,
        inputPreview: previewJson(input),
      });
    });
  }

  private handleCanUseTool(
    toolName: string,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<PermissionResult> {
    return this.requestPanePermission(toolName, input, signal).then(
      (decision) =>
        decision.allowed
          ? { behavior: 'allow', updatedInput: input }
          : {
              behavior: 'deny',
              message: decision.message ?? '사용자가 이 작업을 거부했습니다.',
            },
    );
  }

  private send(frame: SidecarToPaneFrame): void {
    if (this.ws.readyState !== this.ws.OPEN) {
      return;
    }
    try {
      this.ws.send(serializeFrame(frame));
    } catch (err) {
      this.logger.error('WS send failed', err);
    }
  }

  private emitPerformance(
    name: PerformanceEventName,
    turnId?: number,
    detail?: string,
  ): void {
    this.send({
      v: PROTOCOL_VERSION,
      type: 'performance_event',
      name,
      elapsedMs:
        Math.round((performance.now() - this.sessionStartedAt) * 1000) / 1000,
      ...(turnId === undefined ? {} : { turnId }),
      ...(detail === undefined ? {} : { detail }),
    });
  }
}

function previewJson(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? '';
  } catch {
    text = String(value);
  }
  if (text.length > INPUT_PREVIEW_MAX_CHARS) {
    return `${text.slice(0, INPUT_PREVIEW_MAX_CHARS)}… (${text.length}자 중 일부)`;
  }
  return text;
}
