/** One PowerPoint task-pane WebSocket mapped to one multi-turn SDK query. */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
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
  type UserMessageFrame,
  type QuestionSpec,
} from '../shared/messages.js';
import type { SidecarConfig } from './config.js';
import {
  AttachmentValidationError,
  formatPromptWithAttachments,
} from './attachments.js';
import {
  generatePowerPointReport,
  isReportCommand,
} from './report-generator.js';
import type { Logger } from './logger.js';

export interface SessionEnv {
  port: number;
  version: string;
  config: SidecarConfig;
}

const PERMISSION_TIMEOUT_MS = 300_000;
const INPUT_PREVIEW_MAX_CHARS = 2_000;

class PushQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: Array<(r: IteratorResult<T>) => void> = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: item, done: false });
    else this.items.push(item);
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
  answers?: Record<string, string>;
}

interface PendingPermission {
  settle: (decision: PermissionDecision) => void;
  toolName: string;
  questionCount?: number;
}

export class PaneSession {
  private readonly sessionId = randomUUID();
  private readonly inputQueue = new PushQueue<SDKUserMessage>();
  private readonly abortController = new AbortController();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly sessionAllowedTools = new Set<string>();
  private readonly toolUseNames = new Map<string, string>();
  private queryInstance: Query | null = null;
  private permissionSeq = 0;
  private turnId = 0;
  private disposed = false;

  constructor(
    private readonly ws: WebSocket,
    private readonly hello: HelloFrame,
    private readonly env: SessionEnv,
    private readonly logger: Logger,
  ) {
    logger.info(
      `Pane session ${this.sessionId} started (host=${hello.host ?? '?'} platform=${hello.platform ?? '?'} sets=${JSON.stringify(hello.requirementSets)})`,
    );
    this.prewarmQuery();
  }

  private prewarmQuery(): void {
    try {
      const q = this.ensureQuery();
      void q.initialized.then(
        () => this.sendHello(),
        (err) => {
          this.logger.warn(`Agent session prewarm failed: ${String(err)}`);
          this.sendHello();
        },
      );
    } catch (err) {
      this.logger.warn(`Agent session prewarm failed: ${String(err)}`);
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
        this.handleUserMessage(frame);
        break;
      case 'permission_response': {
        const pending = this.pendingPermissions.get(frame.id);
        if (!pending) return;
        if (frame.behavior === 'allow') {
          if (frame.alwaysAllow) {
            const baseName = baseToolName(pending.toolName);
            this.sessionAllowedTools.add(baseName);
            for (const other of Array.from(this.pendingPermissions.values())) {
              if (
                other !== pending &&
                baseToolName(other.toolName) === baseName
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
      case 'question_response': {
        const pending = this.pendingPermissions.get(frame.id);
        if (
          !pending ||
          baseToolName(pending.toolName) !== 'ask_user_question'
        ) {
          return;
        }
        const answers = normalizeQuestionAnswers(
          frame.answers,
          pending.questionCount ?? 0,
        );
        if (frame.behavior === 'answer' && answers) {
          pending.settle({ allowed: true, answers });
        } else {
          pending.settle({
            allowed: false,
            message: '사용자가 질문을 취소했습니다.',
          });
        }
        break;
      }
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
    if (this.disposed) return;
    this.disposed = true;
    this.logger.info(`Disposing session ${this.sessionId}: ${reason}`);
    this.inputQueue.end();
    for (const pending of Array.from(this.pendingPermissions.values())) {
      pending.settle({ allowed: false, message: reason });
    }
    this.pendingPermissions.clear();
    this.abortController.abort();
  }

  private handleUserMessage(frame: UserMessageFrame): void {
    if (!frame.text || !frame.text.trim()) return;
    this.turnId += 1;

    let prompt: string;
    try {
      prompt = formatPromptWithAttachments(frame.text, frame.attachments);
    } catch (err) {
      const validation =
        err instanceof AttachmentValidationError ? err : undefined;
      this.logger.warn(
        `Rejected attachment payload: ${validation?.code ?? String(err)}`,
      );
      this.send({
        v: PROTOCOL_VERSION,
        type: 'error',
        code: validation?.code ?? 'INVALID_ATTACHMENT',
        messageKo: validation?.message ?? '첨부 파일을 처리할 수 없습니다.',
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'turn_complete',
        turnId: this.turnId,
        isError: true,
        errorMessage: '첨부 파일 처리 실패',
      });
      return;
    }

    if (isReportCommand(frame.text)) {
      void this.handleReportCommand(frame);
      return;
    }

    try {
      this.ensureQuery();
    } catch (err) {
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
        turnId: this.turnId,
        isError: true,
        errorMessage: '에이전트 시작 실패',
      });
      return;
    }

    this.inputQueue.push({
      type: 'user',
      session_id: this.sessionId,
      message: { role: 'user', content: prompt },
      parent_tool_use_id: null,
    });
  }

  private async handleReportCommand(frame: UserMessageFrame): Promise<void> {
    const attachment = frame.attachments?.find(
      (item) => /\.md$/i.test(item.name) || item.mimeType === 'text/markdown',
    );
    if (!attachment) {
      this.send({
        v: PROTOCOL_VERSION,
        type: 'error',
        code: 'REPORT_MARKDOWN_REQUIRED',
        messageKo: '/report 명령에는 Markdown 회의록 파일을 첨부해야 합니다.',
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'turn_complete',
        turnId: this.turnId,
        isError: true,
        errorMessage: 'Markdown 회의록이 없습니다.',
      });
      return;
    }

    const currentTurn = this.turnId;
    this.send({
      v: PROTOCOL_VERSION,
      type: 'tool_activity',
      turnId: currentTurn,
      toolName: 'powerpoint_report',
      status: 'start',
      summary: `${attachment.name} → A4 PPTX`,
    });
    try {
      const outputPath = await generatePowerPointReport(
        attachment,
        `${this.env.config.workDir}/reports`,
      );
      this.send({
        v: PROTOCOL_VERSION,
        type: 'tool_activity',
        turnId: currentTurn,
        toolName: 'powerpoint_report',
        status: 'end',
        summary: outputPath,
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'assistant_message',
        turnId: currentTurn,
        blocks: [
          {
            type: 'text',
            text: `A4 책임자 제출용 PPTX를 생성하고 재열기 검증했습니다.\n${outputPath}`,
          },
        ],
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'turn_complete',
        turnId: currentTurn,
        isError: false,
      });
    } catch (err) {
      this.logger.error('PowerPoint report generation failed', err);
      this.send({
        v: PROTOCOL_VERSION,
        type: 'tool_activity',
        turnId: currentTurn,
        toolName: 'powerpoint_report',
        status: 'end',
        isError: true,
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'error',
        code: 'REPORT_GENERATION_FAILED',
        messageKo: 'PowerPoint 보고서 생성 또는 재열기 검증에 실패했습니다.',
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'turn_complete',
        turnId: currentTurn,
        isError: true,
        errorMessage: String(err),
      });
    }
  }

  private ensureQuery(): Query {
    if (this.queryInstance) return this.queryInstance;
    const config = this.env.config;
    fs.mkdirSync(config.workDir, { recursive: true });
    const options: QueryOptions = {
      cwd: config.workDir,
      pathToMoliExecutable: config.cliPath,
      model: config.model,
      permissionMode: 'default',
      excludeTools: config.excludeTools,
      includePartialMessages: true,
      sessionId: this.sessionId,
      abortController: this.abortController,
      canUseTool: (toolName, input, { signal }) =>
        this.handleCanUseTool(toolName, input, signal),
      timeout: { canUseTool: PERMISSION_TIMEOUT_MS },
      stderr: (message) => this.logger.debug(`cli stderr: ${message}`),
    };
    this.logger.info(
      `Starting agent session ${this.sessionId} (cli=${config.cliPath ?? '<auto>'} cwd=${config.workDir})`,
    );
    this.queryInstance = query({ prompt: this.inputQueue, options });
    void this.pumpMessages(this.queryInstance);
    return this.queryInstance;
  }

  private async pumpMessages(q: Query): Promise<void> {
    try {
      for await (const message of q) this.handleSdkMessage(message);
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
        if (message.parent_tool_use_id) return;
        const event = message.event;
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
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
        if (message.parent_tool_use_id) return;
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
        const content = message.message.content;
        if (typeof content === 'string') return;
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
      case 'result':
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
      case 'system':
        this.logger.debug(`system message: ${message.subtype}`);
        break;
      default:
        break;
    }
  }

  private requestPanePermission(
    toolName: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<PermissionDecision> {
    const baseName = baseToolName(toolName);
    if (
      baseName !== 'ask_user_question' &&
      this.sessionAllowedTools.has(baseName)
    ) {
      return Promise.resolve({ allowed: true });
    }
    const id = `perm-${++this.permissionSeq}`;
    return new Promise((resolve) => {
      const settle = (decision: PermissionDecision): void => {
        if (this.pendingPermissions.delete(id)) resolve(decision);
      };
      this.pendingPermissions.set(id, { toolName, settle });
      signal?.addEventListener('abort', () => {
        settle({ allowed: false, message: '요청이 취소되었습니다.' });
      });
      if (baseName === 'ask_user_question') {
        const questions = input['questions'];
        if (!isQuestionSpecArray(questions)) {
          settle({
            allowed: false,
            message: '질문 형식이 올바르지 않습니다.',
          });
          return;
        }
        const pending = this.pendingPermissions.get(id);
        if (pending) pending.questionCount = questions.length;
        this.send({
          v: PROTOCOL_VERSION,
          type: 'question_request',
          id,
          questions,
        });
      } else {
        this.send({
          v: PROTOCOL_VERSION,
          type: 'permission_request',
          id,
          toolName,
          inputPreview: previewJson(input),
        });
      }
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
          ? {
              behavior: 'allow',
              updatedInput: input,
              ...(decision.answers ? { answers: decision.answers } : {}),
            }
          : {
              behavior: 'deny',
              message: decision.message ?? '사용자가 이 작업을 거부했습니다.',
            },
    );
  }

  private send(frame: SidecarToPaneFrame): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    try {
      this.ws.send(serializeFrame(frame));
    } catch (err) {
      this.logger.error('WS send failed', err);
    }
  }
}

function baseToolName(toolName: string): string {
  const idx = toolName.lastIndexOf('__');
  return idx >= 0 ? toolName.slice(idx + 2) : toolName;
}

function previewJson(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? '';
  } catch {
    text = String(value);
  }
  return text.length > INPUT_PREVIEW_MAX_CHARS
    ? `${text.slice(0, INPUT_PREVIEW_MAX_CHARS)}… (${text.length}자 중 일부)`
    : text;
}

function isQuestionSpecArray(value: unknown): value is QuestionSpec[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    return false;
  }
  for (const item of value) {
    if (!item || typeof item !== 'object') return false;
    const q = item as Partial<QuestionSpec>;
    if (
      typeof q.question !== 'string' ||
      q.question.length > 1_000 ||
      typeof q.header !== 'string' ||
      q.header.length > 12 ||
      typeof q.multiSelect !== 'boolean' ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      q.options.length > 4
    ) {
      return false;
    }
    for (const option of q.options) {
      if (
        !option ||
        typeof option.label !== 'string' ||
        option.label.length > 100 ||
        typeof option.description !== 'string' ||
        option.description.length > 1_000
      ) {
        return false;
      }
    }
  }
  return true;
}

function normalizeQuestionAnswers(
  value: { [index: string]: string } | undefined,
  count: number,
): Record<string, string> | null {
  if (!value || count < 1 || Object.keys(value).length !== count) return null;
  const normalized: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const answer = value[String(i)];
    if (typeof answer !== 'string') return null;
    const trimmed = answer.trim();
    if (!trimmed || trimmed.length > 4_000) return null;
    normalized[String(i)] = trimmed;
  }
  return normalized;
}
