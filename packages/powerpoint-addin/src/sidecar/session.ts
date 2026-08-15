/** One PowerPoint task-pane WebSocket mapped to one multi-turn SDK query. */

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
  type LocalFileAttachment,
  type UserMessageFrame,
  type QuestionSpec,
  type PerformanceEventName,
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
import { saveTemplateAttachment } from './template-attachment.js';
import {
  buildTemplateExtractionPrompt,
  fallbackTemplateReport,
  parseTemplateReportOutput,
} from './template-report-spec.js';
import { generateTemplateReport } from './template-report-generator.js';
import type { Logger } from './logger.js';

export interface SessionEnv {
  port: number;
  version: string;
  config: SidecarConfig;
}

const PERMISSION_TIMEOUT_MS = 300_000;
const INPUT_PREVIEW_MAX_CHARS = 2_000;
const TEMPLATE_REPORT_TIMEOUT_MS = 45_000;
const TEMPLATE_MODEL_BUDGET_MS = 32_000;
const TEMPLATE_COM_RESERVE_MS = 10_000;

class PushQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private readonly waiters: Array<(r: IteratorResult<T>) => void> = [];
  private closed = false;

  push(item: T): boolean {
    if (this.closed) return false;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: item, done: false });
    else this.items.push(item);
    return true;
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

interface ActiveTemplateTurn {
  turnId: number;
  generation: number;
  templatePath: string;
  minutes: string;
  streamedText: string;
  finalText: string;
  modelTimeout: ReturnType<typeof setTimeout> | null;
  deadlineTimeout: ReturnType<typeof setTimeout> | null;
  deadlineAtMs: number;
  phase: 'saving' | 'model' | 'generating';
  completed: boolean;
}

interface ActiveModelTurn {
  turnId: number;
  generation: number;
  kind: 'ordinary' | 'template';
}

export class PaneSession {
  private readonly sessionId = randomUUID();
  private sdkSessionId = randomUUID();
  private inputQueue = new PushQueue<SDKUserMessage>();
  private readonly abortController = new AbortController();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly sessionAllowedTools = new Set<string>();
  private readonly toolUseNames = new Map<string, string>();
  private queryInstance: Query | null = null;
  private queryGeneration = 1;
  private readonly terminatedQueryGenerations = new Set<number>();
  private activeModelTurn: ActiveModelTurn | null = null;
  private permissionSeq = 0;
  private turnId = 0;
  private firstDeltaTurn = 0;
  private disposed = false;
  private activeTemplateTurn: ActiveTemplateTurn | null = null;
  private activeReportTurn: number | null = null;
  private readonly sessionStartedAt = performance.now();

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
      const generation = this.queryGeneration;
      void q.initialized.then(
        () => {
          if (generation !== this.queryGeneration) return;
          this.emitPerformance('cli_initialized');
          this.sendHello();
        },
        (err) => {
          if (generation !== this.queryGeneration) return;
          this.logger.warn(`Agent session prewarm failed: ${String(err)}`);
          this.emitPerformance('query_prewarm_failed', undefined, String(err));
          this.sendHello();
        },
      );
    } catch (err) {
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
    if (this.activeTemplateTurn) {
      this.clearTemplateTimers(this.activeTemplateTurn);
      this.activeTemplateTurn.completed = true;
      this.activeTemplateTurn = null;
    }
    this.activeModelTurn = null;
    this.abortController.abort();
  }

  private handleUserMessage(frame: UserMessageFrame): void {
    if (!frame.text || !frame.text.trim()) return;
    this.turnId += 1;

    if (this.activeTemplateTurn) {
      this.sendTemplateError(
        this.turnId,
        'TEMPLATE_REPORT_BUSY',
        '템플릿 보고서를 생성하는 중입니다. 완료 후 다시 요청해 주세요.',
        '템플릿 보고서 생성 중',
      );
      return;
    }
    if (this.activeReportTurn !== null) {
      this.sendTemplateError(
        this.turnId,
        'REPORT_BUSY',
        'PowerPoint 보고서를 생성하는 중입니다. 완료 후 다시 요청해 주세요.',
        'PowerPoint 보고서 생성 중',
      );
      return;
    }
    if (this.activeModelTurn) {
      this.sendTemplateError(
        this.turnId,
        'MODEL_TURN_BUSY',
        '이전 모델 요청을 처리하는 중입니다. 완료 후 다시 요청해 주세요.',
        '모델 요청 처리 중',
      );
      return;
    }

    if (isTemplateReportCommand(frame.text)) {
      const attachment = onlyPptxAttachment(frame.attachments);
      const minutes = stripTemplateReportInput(frame.text, attachment?.name);
      if (!attachment || !minutes) {
        this.sendTemplateError(
          this.turnId,
          !attachment
            ? 'TEMPLATE_REPORT_PPTX_REQUIRED'
            : 'TEMPLATE_REPORT_MINUTES_REQUIRED',
          !attachment
            ? '/template-report 명령에는 PPTX 템플릿 하나만 첨부해야 합니다.'
            : '/template-report 명령에는 줄글 회의록을 입력해야 합니다.',
          !attachment ? 'PPTX 템플릿이 없습니다.' : '회의록 본문이 없습니다.',
        );
        return;
      }
      void this.handleTemplateReportCommand(this.turnId, attachment, minutes);
      return;
    }

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
      this.activeReportTurn = this.turnId;
      void this.handleReportCommand(frame, this.turnId);
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

    this.activeModelTurn = {
      turnId: this.turnId,
      generation: this.queryGeneration,
      kind: 'ordinary',
    };
    const pushed = this.inputQueue.push({
      type: 'user',
      session_id: this.sdkSessionId,
      message: { role: 'user', content: prompt },
      parent_tool_use_id: null,
    });
    if (!pushed) {
      this.activeModelTurn = null;
      this.sendTemplateError(
        this.turnId,
        'AGENT_INPUT_CLOSED',
        '모델 입력 세션이 종료되었습니다.',
        '모델 입력 실패',
      );
      return;
    }
    this.emitPerformance('user_message_enqueued', this.turnId);
  }

  private sendTemplateError(
    turnId: number,
    code: string,
    messageKo: string,
    errorMessage: string,
  ): void {
    this.send({ v: PROTOCOL_VERSION, type: 'error', code, messageKo });
    this.send({
      v: PROTOCOL_VERSION,
      type: 'turn_complete',
      turnId,
      isError: true,
      errorMessage,
    });
  }

  private async handleTemplateReportCommand(
    turnId: number,
    attachment: LocalFileAttachment,
    minutes: string,
  ): Promise<void> {
    try {
      this.ensureQuery();
    } catch (error) {
      this.logger.error('Failed to start template report session', error);
      this.sendTemplateError(
        turnId,
        'AGENT_START_FAILED',
        '보고서 추출 모델을 시작하지 못했습니다.',
        '에이전트 시작 실패',
      );
      return;
    }

    const active: ActiveTemplateTurn = {
      turnId,
      generation: this.queryGeneration,
      templatePath: '',
      minutes,
      streamedText: '',
      finalText: '',
      modelTimeout: null,
      deadlineTimeout: null,
      deadlineAtMs: Date.now() + TEMPLATE_REPORT_TIMEOUT_MS,
      phase: 'saving',
      completed: false,
    };
    this.activeTemplateTurn = active;
    active.deadlineTimeout = setTimeout(
      () => this.deadlineTemplateTurn(active),
      TEMPLATE_REPORT_TIMEOUT_MS,
    );

    try {
      active.templatePath = await saveTemplateAttachment(
        attachment,
        this.env.config.workDir,
      );
      if (active.completed || this.activeTemplateTurn !== active) return;
      active.phase = 'model';
      active.generation = this.queryGeneration;
      this.activeModelTurn = {
        turnId,
        generation: this.queryGeneration,
        kind: 'template',
      };
      const pushed = this.inputQueue.push({
        type: 'user',
        session_id: this.sdkSessionId,
        message: {
          role: 'user',
          content: buildTemplateExtractionPrompt(minutes),
        },
        parent_tool_use_id: null,
      });
      if (!pushed) throw new Error('AGENT_INPUT_CLOSED');
      const modelBudget = Math.min(
        TEMPLATE_MODEL_BUDGET_MS,
        this.remainingTemplateMs(active) - TEMPLATE_COM_RESERVE_MS,
      );
      if (modelBudget <= 0) {
        this.fallbackSlowTemplateModel(active);
        return;
      }
      active.modelTimeout = setTimeout(
        () => this.fallbackSlowTemplateModel(active),
        modelBudget,
      );
      this.emitPerformance('user_message_enqueued', turnId);
    } catch (error) {
      if (active.completed || this.activeTemplateTurn !== active) return;
      active.completed = true;
      this.clearTemplateTimers(active);
      if (this.activeModelTurn?.turnId === turnId) {
        this.activeModelTurn = null;
      }
      this.logger.error('Template attachment storage failed', error);
      this.sendTemplateError(
        turnId,
        (error as { code?: string }).code ?? 'TEMPLATE_REPORT_INPUT_FAILED',
        'PPTX 템플릿을 안전하게 저장하지 못했습니다.',
        String(error),
      );
      if (this.activeTemplateTurn === active) this.activeTemplateTurn = null;
    }
  }

  private deadlineTemplateTurn(active: ActiveTemplateTurn): void {
    if (this.activeTemplateTurn !== active || active.completed) {
      return;
    }
    this.clearTemplateTimers(active);
    active.completed = true;
    this.activeTemplateTurn = null;
    if (
      this.activeModelTurn?.turnId === active.turnId &&
      this.activeModelTurn.generation === active.generation
    ) {
      this.activeModelTurn = null;
    }
    this.sendTemplateError(
      active.turnId,
      'TEMPLATE_REPORT_TIMEOUT',
      '보고서 구조화가 45초를 초과해 중단되었습니다.',
      '템플릿 보고서 시간 초과',
    );
    if (active.phase === 'model') this.replaceCurrentQuery(true);
  }

  private remainingTemplateMs(active: ActiveTemplateTurn): number {
    return Math.max(0, active.deadlineAtMs - Date.now());
  }

  private clearTemplateTimers(active: ActiveTemplateTurn): void {
    if (active.modelTimeout) clearTimeout(active.modelTimeout);
    if (active.deadlineTimeout) clearTimeout(active.deadlineTimeout);
    active.modelTimeout = null;
    active.deadlineTimeout = null;
  }

  private fallbackSlowTemplateModel(active: ActiveTemplateTurn): void {
    if (
      this.activeTemplateTurn !== active ||
      active.completed ||
      active.phase !== 'model'
    ) {
      return;
    }
    if (active.modelTimeout) clearTimeout(active.modelTimeout);
    active.modelTimeout = null;
    if (
      this.activeModelTurn?.turnId === active.turnId &&
      this.activeModelTurn.generation === active.generation
    ) {
      this.activeModelTurn = null;
    }
    active.phase = 'generating';
    this.replaceCurrentQuery(true);
    void this.finishTemplateTurn(active, true);
  }

  private async handleReportCommand(
    frame: UserMessageFrame,
    currentTurn: number,
  ): Promise<void> {
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
      if (this.activeReportTurn === currentTurn) this.activeReportTurn = null;
      return;
    }

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
        this.env.config.workDir,
      );
      this.emitPerformance('artifact_saved', currentTurn, outputPath);
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
    } finally {
      if (this.activeReportTurn === currentTurn) this.activeReportTurn = null;
    }
  }

  private ensureQuery(): Query {
    if (this.queryInstance) return this.queryInstance;
    const config = this.env.config;
    const generation = this.queryGeneration;
    fs.mkdirSync(config.workDir, { recursive: true });
    const options: QueryOptions = {
      cwd: config.workDir,
      pathToMoliExecutable: config.cliPath,
      model: config.model,
      permissionMode: 'default',
      excludeTools: config.excludeTools,
      includePartialMessages: true,
      sessionId: this.sdkSessionId,
      abortController: this.abortController,
      canUseTool: (toolName, input, { signal }) =>
        generation === this.queryGeneration
          ? this.handleCanUseTool(toolName, input, signal)
          : Promise.resolve({ behavior: 'deny', message: 'STALE_QUERY' }),
      timeout: { canUseTool: PERMISSION_TIMEOUT_MS },
      stderr: (message) => this.logger.debug(`cli stderr: ${message}`),
    };
    this.logger.info(
      `Starting agent session ${this.sessionId} (cli=${config.cliPath ?? '<auto>'} cwd=${config.workDir})`,
    );
    this.emitPerformance('query_spawn_started');
    this.queryInstance = query({ prompt: this.inputQueue, options });
    void this.pumpMessages(this.queryInstance, this.queryGeneration);
    return this.queryInstance;
  }

  private replaceCurrentQuery(interruptStale: boolean): void {
    const staleQuery = this.queryInstance;
    this.inputQueue.end();
    this.queryInstance = null;
    this.inputQueue = new PushQueue<SDKUserMessage>();
    this.sdkSessionId = randomUUID();
    this.queryGeneration += 1;
    if (interruptStale) {
      staleQuery?.interrupt().catch((error) => {
        this.logger.error('Template report timeout interrupt failed', error);
      });
    }
    try {
      const replacement = this.ensureQuery();
      const generation = this.queryGeneration;
      void replacement.initialized.then(
        () => {
          if (generation === this.queryGeneration) {
            this.emitPerformance('cli_initialized');
          }
        },
        (error) => {
          if (generation === this.queryGeneration) {
            this.logger.warn(
              `Replacement session prewarm failed: ${String(error)}`,
            );
            this.emitPerformance(
              'query_prewarm_failed',
              undefined,
              String(error),
            );
          }
        },
      );
    } catch (error) {
      this.logger.error('Failed to replace timed-out agent session', error);
    }
  }

  private async pumpMessages(q: Query, generation: number): Promise<void> {
    let failure: unknown;
    try {
      for await (const message of q) {
        if (generation !== this.queryGeneration) return;
        await this.handleSdkMessage(message, generation);
      }
    } catch (err) {
      failure = err;
    } finally {
      await this.handlePumpTermination(generation, failure);
    }
  }

  private async handlePumpTermination(
    generation: number,
    failure: unknown,
  ): Promise<void> {
    if (
      this.disposed ||
      generation !== this.queryGeneration ||
      this.terminatedQueryGenerations.has(generation)
    ) {
      return;
    }
    this.terminatedQueryGenerations.add(generation);
    if (failure) this.logger.error('SDK message pump failed', failure);
    else this.logger.warn('SDK message pump ended unexpectedly');

    const activeTemplate = this.activeTemplateTurn;
    if (
      activeTemplate &&
      !activeTemplate.completed &&
      activeTemplate.generation === generation
    ) {
      if (activeTemplate.phase === 'model') {
        if (activeTemplate.modelTimeout) {
          clearTimeout(activeTemplate.modelTimeout);
          activeTemplate.modelTimeout = null;
        }
        if (
          this.activeModelTurn?.kind === 'template' &&
          this.activeModelTurn.generation === generation
        ) {
          this.activeModelTurn = null;
        }
        activeTemplate.phase = 'generating';
        this.replaceCurrentQuery(false);
        await this.finishTemplateTurn(activeTemplate, true);
        return;
      }
      if (activeTemplate.phase === 'saving') {
        activeTemplate.completed = true;
        this.activeTemplateTurn = null;
        this.activeModelTurn = null;
        this.sendTemplateError(
          activeTemplate.turnId,
          'AGENT_ERROR',
          '보고서 추출 모델 세션이 예기치 않게 종료되었습니다.',
          '모델 세션 종료',
        );
        this.replaceCurrentQuery(false);
        return;
      }
      // The COM generation path owns exactly-once completion.
      this.replaceCurrentQuery(false);
      return;
    }

    const activeModel = this.activeModelTurn;
    if (
      activeModel?.kind === 'ordinary' &&
      activeModel.generation === generation
    ) {
      this.activeModelTurn = null;
      this.sendTemplateError(
        activeModel.turnId,
        'AGENT_ERROR',
        '모델 세션이 예기치 않게 종료되었습니다. 요청을 다시 보내 주세요.',
        '모델 세션 종료',
      );
      this.replaceCurrentQuery(false);
      return;
    }

    this.replaceCurrentQuery(false);
  }

  private async handleSdkMessage(
    message: SDKMessage,
    generation: number,
  ): Promise<void> {
    if (generation !== this.queryGeneration) return;
    const active = this.activeTemplateTurn;
    if (
      active &&
      !active.completed &&
      active.phase === 'model' &&
      active.generation === generation
    ) {
      const consumed = await this.handleTemplateSdkMessage(message, active);
      if (consumed) return;
    }
    const responseTurnId = this.activeModelTurn?.turnId ?? this.turnId;
    switch (message.type) {
      case 'stream_event': {
        if (message.parent_tool_use_id) return;
        const event = message.event;
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          if (this.firstDeltaTurn !== responseTurnId) {
            this.firstDeltaTurn = responseTurnId;
            this.emitPerformance('first_delta_received', responseTurnId);
          }
          this.send({
            v: PROTOCOL_VERSION,
            type: 'assistant_delta',
            turnId: responseTurnId,
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
              turnId: responseTurnId,
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
              turnId: responseTurnId,
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
            turnId: responseTurnId,
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
              turnId: responseTurnId,
              toolName,
              status: 'end',
              isError: block.is_error === true,
            });
          }
        }
        break;
      }
      case 'result': {
        const completedTurn = this.activeModelTurn;
        if (!completedTurn || completedTurn.generation !== generation) return;
        this.activeModelTurn = null;
        this.send({
          v: PROTOCOL_VERSION,
          type: 'turn_complete',
          turnId: completedTurn.turnId,
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

  private async handleTemplateSdkMessage(
    message: SDKMessage,
    active: ActiveTemplateTurn,
  ): Promise<boolean> {
    switch (message.type) {
      case 'stream_event': {
        if (message.parent_tool_use_id) return true;
        const event = message.event;
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          active.streamedText += event.delta.text;
          if (this.firstDeltaTurn !== active.turnId) {
            this.firstDeltaTurn = active.turnId;
            this.emitPerformance('first_delta_received', active.turnId);
          }
        }
        return true;
      }
      case 'assistant': {
        if (message.parent_tool_use_id) return true;
        const text = message.message.content
          .filter(
            (block): block is Extract<typeof block, { type: 'text' }> =>
              block.type === 'text',
          )
          .map((block) => block.text)
          .join('\n');
        if (text) active.finalText = text;
        return true;
      }
      case 'user':
        return true;
      case 'result':
        if (
          this.activeModelTurn?.kind === 'template' &&
          this.activeModelTurn.turnId === active.turnId &&
          this.activeModelTurn.generation === active.generation
        ) {
          this.activeModelTurn = null;
        }
        active.phase = 'generating';
        await this.finishTemplateTurn(active, message.is_error);
        return true;
      case 'system':
        return false;
      default:
        return true;
    }
  }

  private async finishTemplateTurn(
    active: ActiveTemplateTurn,
    modelFailed: boolean,
  ): Promise<void> {
    if (active.completed || this.activeTemplateTurn !== active) return;
    active.phase = 'generating';
    if (active.modelTimeout) {
      clearTimeout(active.modelTimeout);
      active.modelTimeout = null;
    }
    try {
      const raw = active.finalText || active.streamedText;
      const spec = modelFailed
        ? fallbackTemplateReport(active.minutes)
        : parseTemplateReportOutput(raw, active.minutes);
      const outputPath = await generateTemplateReport(
        active.templatePath,
        spec,
        `${this.env.config.workDir}/reports`,
        this.env.config.workDir,
        this.remainingTemplateMs(active),
      );
      if (active.completed || this.activeTemplateTurn !== active) return;
      this.emitPerformance('artifact_saved', active.turnId, outputPath);
      this.send({
        v: PROTOCOL_VERSION,
        type: 'assistant_message',
        turnId: active.turnId,
        blocks: [
          {
            type: 'text',
            text: `템플릿 양식을 적용한 PPTX 보고서를 만들었습니다.\n${outputPath}`,
          },
        ],
      });
      this.send({
        v: PROTOCOL_VERSION,
        type: 'turn_complete',
        turnId: active.turnId,
        isError: false,
      });
    } catch (error) {
      if (active.completed || this.activeTemplateTurn !== active) return;
      if (/REPORT_GENERATION_TIMEOUT/.test(String(error))) {
        this.deadlineTemplateTurn(active);
        return;
      }
      this.logger.error('Template report generation failed', error);
      this.sendTemplateError(
        active.turnId,
        'TEMPLATE_REPORT_GENERATION_FAILED',
        '템플릿 PPTX 보고서를 생성하거나 검증하지 못했습니다.',
        String(error),
      );
    } finally {
      if (this.activeTemplateTurn === active) {
        this.clearTemplateTimers(active);
        active.completed = true;
        this.activeTemplateTurn = null;
      }
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
    if (this.activeTemplateTurn) {
      return Promise.resolve({
        behavior: 'deny',
        message: 'TEMPLATE_REPORT_TOOL_DISABLED',
      });
    }
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

function baseToolName(toolName: string): string {
  const idx = toolName.lastIndexOf('__');
  return idx >= 0 ? toolName.slice(idx + 2) : toolName;
}

function isTemplateReportCommand(text: string): boolean {
  return /^\/template-report(?:\s|$)/i.test(text.trim());
}

function onlyPptxAttachment(
  attachments: LocalFileAttachment[] | undefined,
): LocalFileAttachment | undefined {
  if (attachments?.length !== 1) return undefined;
  const attachment = attachments[0];
  return /\.pptx$/i.test(attachment.name) && attachment.encoding === 'base64'
    ? attachment
    : undefined;
}

function stripTemplateReportInput(
  text: string,
  attachmentName: string | undefined,
): string {
  let minutes = text
    .trim()
    .replace(/^\/template-report(?:\s|$)/i, '')
    .trim();
  if (attachmentName) {
    const escapedName = attachmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    minutes = minutes
      .replace(new RegExp(`@${escapedName}(?=\\s|$)`, 'gi'), '')
      .trim();
  }
  return minutes;
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
