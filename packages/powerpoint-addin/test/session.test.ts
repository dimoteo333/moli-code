import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SDKMessage, SDKUserMessage } from '@dobby/moli-code-sdk';
import {
  PROTOCOL_VERSION,
  parseFrame,
  type AnyFrame,
  type HelloFrame,
  type SidecarToPaneFrame,
} from '../src/shared/messages.js';

interface CapturedQuery {
  prompt: AsyncIterable<SDKUserMessage>;
  options: Record<string, unknown>;
  interrupt: ReturnType<typeof vi.fn>;
  emit: (message: SDKMessage) => void;
  end: () => void;
  fail: (error: Error) => void;
}

const captured: CapturedQuery[] = [];
const generatePowerPointReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue('C:\\reports\\meeting-report.pptx'),
);
const saveTemplateAttachment = vi.hoisted(() =>
  vi.fn().mockResolvedValue('C:\\work\\templates\\template-saved.pptx'),
);
const buildTemplateExtractionPrompt = vi.hoisted(() =>
  vi.fn((minutes: string) => `EXTRACT_ONLY:${minutes}`),
);
const parseTemplateReportOutput = vi.hoisted(() =>
  vi.fn(() => ({
    title: 'parsed',
    date: '2026.07.19',
    department: '기획부',
    pages: [],
  })),
);
const fallbackTemplateReport = vi.hoisted(() =>
  vi.fn(() => ({
    title: 'fallback',
    date: '2026.07.19',
    department: '기획부',
    pages: [],
  })),
);
const generateTemplateReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue('C:\\work\\reports\\template-report.pptx'),
);

vi.mock('../src/sidecar/report-generator.js', () => ({
  isReportCommand: (text: string) => /^\/report(?:\s|$)/i.test(text.trim()),
  generatePowerPointReport,
}));

vi.mock('../src/sidecar/template-attachment.js', () => ({
  saveTemplateAttachment,
}));

vi.mock('../src/sidecar/template-report-spec.js', () => ({
  buildTemplateExtractionPrompt,
  parseTemplateReportOutput,
  fallbackTemplateReport,
}));

vi.mock('../src/sidecar/template-report-generator.js', () => ({
  generateTemplateReport,
}));

vi.mock('@dobby/moli-code-sdk', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    query: ({
      prompt,
      options,
    }: {
      prompt: AsyncIterable<SDKUserMessage>;
      options: Record<string, unknown>;
    }) => {
      const interrupt = vi.fn().mockResolvedValue(undefined);
      const items: SDKMessage[] = [];
      const waiters: Array<{
        resolve: (result: IteratorResult<SDKMessage>) => void;
        reject: (error: Error) => void;
      }> = [];
      let terminal: { error?: Error } | null = null;
      const emit = (message: SDKMessage): void => {
        const waiter = waiters.shift();
        if (terminal) return;
        if (waiter) waiter.resolve({ value: message, done: false });
        else items.push(message);
      };
      const end = (): void => {
        if (terminal) return;
        terminal = {};
        for (const waiter of waiters.splice(0)) {
          waiter.resolve({ value: undefined, done: true });
        }
      };
      const fail = (error: Error): void => {
        if (terminal) return;
        terminal = { error };
        for (const waiter of waiters.splice(0)) waiter.reject(error);
      };
      captured.push({ prompt, options, interrupt, emit, end, fail });
      return {
        initialized: Promise.resolve(),
        interrupt,
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<SDKMessage>> {
              const item = items.shift();
              if (item) return Promise.resolve({ value: item, done: false });
              if (terminal?.error) return Promise.reject(terminal.error);
              if (terminal) {
                return Promise.resolve({ value: undefined, done: true });
              }
              return new Promise((resolve, reject) =>
                waiters.push({ resolve, reject }),
              );
            },
          };
        },
      };
    },
  };
});

const { PaneSession } = await import('../src/sidecar/session.js');
const { Logger } = await import('../src/sidecar/logger.js');

class FakeWs {
  readonly OPEN = 1;
  readyState = 1;
  readonly sent: SidecarToPaneFrame[] = [];

  send(data: string): void {
    this.sent.push(parseFrame(data) as SidecarToPaneFrame);
  }

  framesOfType<T extends SidecarToPaneFrame['type']>(
    type: T,
  ): Array<Extract<SidecarToPaneFrame, { type: T }>> {
    return this.sent.filter((f) => f.type === type) as Array<
      Extract<SidecarToPaneFrame, { type: T }>
    >;
  }
}

const hello: HelloFrame = {
  v: PROTOCOL_VERSION,
  type: 'hello',
  token: 'tok',
  requirementSets: { 'PowerPointApi 1.1': true },
  host: 'PowerPoint',
};

function makeSession(ws: FakeWs) {
  return new PaneSession(
    ws as never,
    hello,
    {
      port: 39216,
      version: 'test',
      config: {
        port: 39216,
        certPfxPath: '/dev/null',
        certPassphrase: '',
        workDir: `${process.env['TMPDIR'] ?? '/tmp'}/moli-ppt-test-workspace`,
        excludeTools: [],
        logLevel: 'error',
      },
    },
    new Logger({ minLevel: 'error' }),
  );
}

function frame(extra: Record<string, unknown>): AnyFrame {
  return { v: PROTOCOL_VERSION, ...extra } as AnyFrame;
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function performanceNames(ws: FakeWs): string[] {
  return (ws.sent as unknown as Array<{ type: string; name?: string }>)
    .filter((item) => item.type === 'performance_event')
    .map((item) => item.name ?? '');
}

beforeEach(() => {
  captured.length = 0;
  generatePowerPointReport.mockClear();
  saveTemplateAttachment.mockClear();
  buildTemplateExtractionPrompt.mockClear();
  parseTemplateReportOutput.mockClear();
  fallbackTemplateReport.mockClear();
  generateTemplateReport.mockClear();
});

const templateAttachment = {
  name: 'template.pptx',
  content: 'UEsDBBINARY_TEMPLATE_BYTES',
  size: 20,
  mimeType:
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  encoding: 'base64' as const,
};

function assistantText(text: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: 'assistant-1',
    session_id: 'sdk-session',
    parent_tool_use_id: null,
    message: {
      id: 'message-1',
      type: 'message',
      role: 'assistant',
      model: 'glm',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  } as SDKMessage;
}

function streamText(text: string): SDKMessage {
  return {
    type: 'stream_event',
    uuid: 'partial-1',
    session_id: 'sdk-session',
    parent_tool_use_id: null,
    event: {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    },
  } as SDKMessage;
}

function resultMessage(isError = false): SDKMessage {
  return {
    type: 'result',
    subtype: isError ? 'error_during_execution' : 'success',
    uuid: 'result-1',
    session_id: 'sdk-session',
    is_error: isError,
    duration_ms: 1,
    duration_api_ms: 1,
    num_turns: 1,
    ...(isError ? { error: { message: 'model failed' } } : { result: 'ok' }),
    usage: { input_tokens: 1, output_tokens: 1 },
    permission_denials: [],
  } as SDKMessage;
}

describe('PowerPoint PaneSession', () => {
  it('emits query spawn and CLI readiness before hello_ok', async () => {
    const ws = new FakeWs();
    makeSession(ws);
    expect(performanceNames(ws)).toEqual(['query_spawn_started']);
    await tick();
    expect(performanceNames(ws)).toEqual([
      'query_spawn_started',
      'cli_initialized',
    ]);
    expect(ws.sent.at(-1)).toMatchObject({ type: 'hello_ok' });
  });

  it('generates /report locally without sending the Markdown to the model', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/report @minutes.md',
        attachments: [
          {
            name: 'minutes.md',
            content: '# 회의록',
            size: 12,
            mimeType: 'text/markdown',
          },
        ],
      }),
    );
    await tick();
    await tick();
    expect(generatePowerPointReport).toHaveBeenCalledOnce();
    expect(performanceNames(ws)).toContain('artifact_saved');
    expect(ws.framesOfType('assistant_message')[0].blocks[0].text).toContain(
      'meeting-report.pptx',
    );
    expect(ws.framesOfType('turn_complete')).toMatchObject([
      { isError: false },
    ]);
    expect(captured).toHaveLength(1);
  });

  it('sends hello_ok after query prewarm is ready', async () => {
    const ws = new FakeWs();
    makeSession(ws);
    expect(ws.framesOfType('hello_ok')).toHaveLength(0);
    await tick();
    expect(ws.framesOfType('hello_ok')).toHaveLength(1);
  });

  it('prewarms one query when the pane connects', () => {
    const ws = new FakeWs();
    makeSession(ws);
    expect(captured).toHaveLength(1);
  });

  it('feeds attached file contents into the SDK prompt', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: 'Summarize @tasks.md',
        attachments: [
          {
            name: 'tasks.md',
            content: '# Tasks\n- verify release',
            size: 24,
            mimeType: 'text/markdown',
          },
        ],
      }),
    );

    const iterator = captured[0].prompt[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.value.message.content).toContain('Summarize @tasks.md');
    expect(first.value.message.content).toContain('# Tasks\\n- verify release');
    expect(first.value.message.content).toContain('"reference":"@tasks.md"');
  });

  it.each([
    ['no template', [], '/template-report 회의 내용'],
    [
      'two attachments',
      [templateAttachment, templateAttachment],
      '/template-report 회의 내용',
    ],
    ['empty prose', [templateAttachment], '/template-report @template.pptx   '],
  ])('rejects /template-report with %s', async (_name, attachments, text) => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text, attachments }));
    await tick();

    expect(saveTemplateAttachment).not.toHaveBeenCalled();
    expect(ws.framesOfType('error')).toHaveLength(1);
    expect(ws.framesOfType('turn_complete')).toHaveLength(1);
    expect(ws.framesOfType('turn_complete')[0].isError).toBe(true);
  });

  it('enqueues one extraction prompt on the prewarmed query without template bytes', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 2026-07-19 기획부 회의 내용',
        attachments: [templateAttachment],
      }),
    );
    await tick();

    const iterator = captured[0].prompt[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(captured).toHaveLength(1);
    expect(buildTemplateExtractionPrompt).toHaveBeenCalledWith(
      '2026-07-19 기획부 회의 내용',
    );
    expect(first.value.message.content).toBe(
      'EXTRACT_ONLY:2026-07-19 기획부 회의 내용',
    );
    expect(first.value.message.content).not.toContain(
      templateAttachment.content,
    );
  });

  it('captures hidden JSON and generates one report with exactly one completion', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    await tick();
    captured[0].emit(streamText('{"title":"streamed"}'));
    captured[0].emit(assistantText('{"title":"final"}'));
    captured[0].emit(resultMessage());
    await tick();
    await tick();

    expect(ws.framesOfType('assistant_delta')).toHaveLength(0);
    expect(ws.framesOfType('thinking')).toHaveLength(0);
    expect(parseTemplateReportOutput).toHaveBeenCalledWith(
      '{"title":"final"}',
      '회의 본문',
    );
    expect(generateTemplateReport).toHaveBeenCalledOnce();
    expect(
      performanceNames(ws).filter((name) => name === 'artifact_saved'),
    ).toHaveLength(1);
    expect(ws.framesOfType('assistant_message')).toHaveLength(1);
    expect(ws.framesOfType('assistant_message')[0].blocks[0].text).toContain(
      'template-report.pptx',
    );
    expect(ws.framesOfType('turn_complete')).toEqual([
      expect.objectContaining({ isError: false }),
    ]);
  });

  it('uses the local parser fallback without a second model push', async () => {
    parseTemplateReportOutput.mockReturnValueOnce({
      title: 'fallback',
      date: '2026.07.19',
      department: '기획부',
      pages: [],
    });
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    await tick();
    const iterator = captured[0].prompt[Symbol.asyncIterator]();
    await iterator.next();
    captured[0].emit(assistantText('not-json'));
    captured[0].emit(resultMessage());
    await tick();
    await tick();

    expect(parseTemplateReportOutput).toHaveBeenCalledWith(
      'not-json',
      '회의 본문',
    );
    expect(generateTemplateReport).toHaveBeenCalledOnce();
    const pending = Promise.race([
      iterator.next().then(() => 'second'),
      Promise.resolve('none'),
    ]);
    await expect(pending).resolves.toBe('none');
  });

  it('uses a model-free fallback after a model error', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    await tick();
    captured[0].emit(resultMessage(true));
    await tick();
    await tick();

    expect(fallbackTemplateReport).toHaveBeenCalledWith('회의 본문');
    expect(parseTemplateReportOutput).not.toHaveBeenCalled();
    expect(generateTemplateReport).toHaveBeenCalledOnce();
    expect(ws.framesOfType('turn_complete')).toEqual([
      expect.objectContaining({ isError: false }),
    ]);
  });

  it('denies tool use without opening a permission prompt during extraction', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    const canUseTool = captured[0].options['canUseTool'] as (
      toolName: string,
      input: Record<string, unknown>,
      opts: { signal: AbortSignal },
    ) => Promise<{ behavior: string; message?: string }>;
    await expect(
      canUseTool(
        'write_file',
        { path: 'x' },
        {
          signal: new AbortController().signal,
        },
      ),
    ).resolves.toMatchObject({
      behavior: 'deny',
      message: 'TEMPLATE_REPORT_TOOL_DISABLED',
    });
    expect(ws.framesOfType('permission_request')).toHaveLength(0);
  });

  it('rejects every other user message while a template report is active', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    session.onFrame(frame({ type: 'user_message', text: '다른 요청' }));
    await tick();

    expect(ws.framesOfType('error')).toContainEqual(
      expect.objectContaining({ code: 'TEMPLATE_REPORT_BUSY' }),
    );
    expect(saveTemplateAttachment).toHaveBeenCalledOnce();
  });

  it('waits for an ordinary model result before accepting a template report', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: '일반 모델 요청' }));
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    await tick();

    expect(saveTemplateAttachment).not.toHaveBeenCalled();
    expect(ws.framesOfType('error')).toContainEqual(
      expect.objectContaining({ code: 'MODEL_TURN_BUSY' }),
    );

    captured[0].emit(resultMessage());
    await tick();
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    await tick();
    expect(saveTemplateAttachment).toHaveBeenCalledOnce();
  });

  it('keeps template report busy state while COM generation is pending', async () => {
    const generation = deferred<string>();
    generateTemplateReport.mockReturnValueOnce(generation.promise);
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(
      frame({
        type: 'user_message',
        text: '/template-report @template.pptx 회의 본문',
        attachments: [templateAttachment],
      }),
    );
    await tick();
    captured[0].emit(assistantText('{"title":"final"}'));
    captured[0].emit(resultMessage());
    await tick();
    expect(generateTemplateReport).toHaveBeenCalledOnce();

    session.onFrame(frame({ type: 'user_message', text: '생성 중 새 요청' }));
    expect(ws.framesOfType('error')).toContainEqual(
      expect.objectContaining({ code: 'TEMPLATE_REPORT_BUSY' }),
    );

    generation.resolve('C:\\work\\reports\\template-report.pptx');
    await tick();
    expect(ws.framesOfType('turn_complete').at(-1)).toMatchObject({
      isError: false,
    });
  });

  it('starts the model watchdog only after a slow template save and queue push', async () => {
    vi.useFakeTimers();
    const saved = deferred<string>();
    saveTemplateAttachment.mockReturnValueOnce(saved.promise);
    try {
      const ws = new FakeWs();
      const session = makeSession(ws);
      await vi.runAllTicks();
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 회의 본문',
          attachments: [templateAttachment],
        }),
      );
      await vi.advanceTimersByTimeAsync(60_000);
      expect(captured[0].interrupt).not.toHaveBeenCalled();
      expect(ws.framesOfType('turn_complete')).toHaveLength(0);

      saved.resolve('C:\\work\\templates\\template-saved.pptx');
      await vi.runAllTicks();
      await vi.advanceTimersByTimeAsync(44_999);
      expect(captured[0].interrupt).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(captured[0].interrupt).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts a new model request after timeout without waiting for a terminal result', async () => {
    vi.useFakeTimers();
    try {
      const ws = new FakeWs();
      const session = makeSession(ws);
      await vi.runAllTicks();
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 회의 본문',
          attachments: [templateAttachment],
        }),
      );
      await vi.runAllTicks();
      await vi.advanceTimersByTimeAsync(45_000);
      expect(captured).toHaveLength(2);

      const staleCanUseTool = captured[0].options['canUseTool'] as (
        toolName: string,
        input: Record<string, unknown>,
        opts: { signal: AbortSignal },
      ) => Promise<{ behavior: string; message?: string }>;
      const staleSignal = new AbortController();
      const stalePermission = staleCanUseTool(
        'write_file',
        { path: 'late' },
        { signal: staleSignal.signal },
      );
      staleSignal.abort();
      await expect(stalePermission).resolves.toMatchObject({
        behavior: 'deny',
        message: 'STALE_QUERY',
      });
      expect(ws.framesOfType('permission_request')).toHaveLength(0);

      session.onFrame(frame({ type: 'user_message', text: 'timeout 뒤 요청' }));
      const iterator = captured[1].prompt[Symbol.asyncIterator]();
      const next = await iterator.next();
      expect(next.value.message.content).toBe('timeout 뒤 요청');
      expect(ws.framesOfType('error').at(-1)?.code).toBe(
        'TEMPLATE_REPORT_TIMEOUT',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late result from the replaced query without finishing a new turn', async () => {
    vi.useFakeTimers();
    try {
      const ws = new FakeWs();
      const session = makeSession(ws);
      await vi.runAllTicks();
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 첫 회의록',
          attachments: [templateAttachment],
        }),
      );
      await vi.runAllTicks();
      await vi.advanceTimersByTimeAsync(45_000);
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 새 회의록',
          attachments: [templateAttachment],
        }),
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(buildTemplateExtractionPrompt).toHaveBeenLastCalledWith(
        '새 회의록',
      );

      captured[0].emit(assistantText('{"title":"late"}'));
      captured[0].emit(resultMessage());
      await vi.advanceTimersByTimeAsync(0);
      expect(generateTemplateReport).not.toHaveBeenCalled();

      captured[1].emit(assistantText('{"title":"new"}'));
      captured[1].emit(resultMessage());
      await vi.advanceTimersByTimeAsync(0);
      expect(parseTemplateReportOutput).toHaveBeenCalledWith(
        '{"title":"new"}',
        '새 회의록',
      );
      expect(generateTemplateReport).toHaveBeenCalledOnce();
      expect(ws.framesOfType('turn_complete')).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['throw', 'eof'] as const)(
    'finishes an ordinary turn exactly once when the query ends by %s',
    async (termination) => {
      const ws = new FakeWs();
      const session = makeSession(ws);
      session.onFrame(frame({ type: 'user_message', text: '일반 모델 요청' }));

      if (termination === 'throw') {
        captured[0].fail(new Error('query failed'));
        captured[0].fail(new Error('duplicate failure'));
      } else {
        captured[0].end();
        captured[0].end();
      }
      await tick();
      await tick();

      expect(ws.framesOfType('error')).toEqual([
        expect.objectContaining({ code: 'AGENT_ERROR' }),
      ]);
      expect(ws.framesOfType('turn_complete')).toEqual([
        expect.objectContaining({ turnId: 1, isError: true }),
      ]);
      expect(captured).toHaveLength(2);

      session.onFrame(frame({ type: 'user_message', text: '복구 후 요청' }));
      const iterator = captured[1].prompt[Symbol.asyncIterator]();
      await expect(iterator.next()).resolves.toMatchObject({
        value: { message: { content: '복구 후 요청' } },
      });
    },
  );

  it.each(['throw', 'eof'] as const)(
    'falls back and finishes a template turn exactly once when the query ends by %s',
    async (termination) => {
      const ws = new FakeWs();
      const session = makeSession(ws);
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 회의 본문',
          attachments: [templateAttachment],
        }),
      );
      await tick();

      if (termination === 'throw') {
        captured[0].fail(new Error('query failed'));
        captured[0].fail(new Error('duplicate failure'));
      } else {
        captured[0].end();
        captured[0].end();
      }
      await tick();
      await tick();

      expect(fallbackTemplateReport).toHaveBeenCalledOnce();
      expect(generateTemplateReport).toHaveBeenCalledOnce();
      expect(ws.framesOfType('error')).toHaveLength(0);
      expect(ws.framesOfType('turn_complete')).toEqual([
        expect.objectContaining({ turnId: 1, isError: false }),
      ]);
      expect(captured).toHaveLength(2);
    },
  );

  it('ignores stale pump termination after a new generation starts', async () => {
    vi.useFakeTimers();
    try {
      const ws = new FakeWs();
      const session = makeSession(ws);
      await vi.runAllTicks();
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 첫 회의록',
          attachments: [templateAttachment],
        }),
      );
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(45_000);
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 새 회의록',
          attachments: [templateAttachment],
        }),
      );
      await vi.advanceTimersByTimeAsync(0);

      captured[0].fail(new Error('stale query failed'));
      await vi.advanceTimersByTimeAsync(0);
      expect(
        ws.framesOfType('error').filter((item) => item.code === 'AGENT_ERROR'),
      ).toHaveLength(0);
      expect(generateTemplateReport).not.toHaveBeenCalled();

      captured[1].emit(assistantText('{"title":"new"}'));
      captured[1].emit(resultMessage());
      await vi.advanceTimersByTimeAsync(0);
      expect(generateTemplateReport).toHaveBeenCalledOnce();
      expect(ws.framesOfType('turn_complete')).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('interrupts after 45 seconds and ignores the late result', async () => {
    vi.useFakeTimers();
    try {
      const ws = new FakeWs();
      const session = makeSession(ws);
      await vi.runAllTicks();
      session.onFrame(
        frame({
          type: 'user_message',
          text: '/template-report @template.pptx 회의 본문',
          attachments: [templateAttachment],
        }),
      );
      await vi.advanceTimersByTimeAsync(45_000);

      expect(captured[0].interrupt).toHaveBeenCalledOnce();
      expect(ws.framesOfType('error')).toContainEqual(
        expect.objectContaining({ code: 'TEMPLATE_REPORT_TIMEOUT' }),
      );
      expect(ws.framesOfType('turn_complete')).toHaveLength(1);

      captured[0].emit(streamText('{"late":true}'));
      captured[0].emit(resultMessage());
      await vi.runAllTicks();
      expect(generateTemplateReport).not.toHaveBeenCalled();
      expect(ws.framesOfType('assistant_delta')).toHaveLength(0);
      expect(ws.framesOfType('turn_complete')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('round-trips ask_user_question answers without generic approval', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: 'help me decide' }));
    const canUseTool = captured[0].options['canUseTool'] as (
      toolName: string,
      input: Record<string, unknown>,
      opts: { signal: AbortSignal },
    ) => Promise<{
      behavior: string;
      updatedInput?: Record<string, unknown>;
      answers?: Record<string, string>;
    }>;
    const input = {
      questions: [
        {
          question: 'Which style should be used?',
          header: 'Style',
          options: [
            { label: 'Brief', description: 'Use a concise layout.' },
            { label: 'Detailed', description: 'Include supporting detail.' },
          ],
          multiSelect: false,
        },
      ],
    };

    const resultPromise = canUseTool('ask_user_question', input, {
      signal: new AbortController().signal,
    });
    await tick();
    expect(ws.framesOfType('permission_request')).toHaveLength(0);
    const requests = ws.framesOfType('question_request');
    expect(requests).toHaveLength(1);
    expect(requests[0].questions[0].options[0].label).toBe('Brief');

    session.onFrame(
      frame({
        type: 'question_response',
        id: requests[0].id,
        behavior: 'answer',
        answers: { '0': 'Brief' },
      }),
    );
    await expect(resultPromise).resolves.toEqual({
      behavior: 'allow',
      updatedInput: input,
      answers: { '0': 'Brief' },
    });
  });

  it('denies ask_user_question when the user cancels', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: 'ask' }));
    const canUseTool = captured[0].options['canUseTool'] as (
      toolName: string,
      input: Record<string, unknown>,
      opts: { signal: AbortSignal },
    ) => Promise<{ behavior: string }>;
    const pending = canUseTool(
      'ask_user_question',
      {
        questions: [
          {
            question: 'Continue?',
            header: 'Continue',
            options: [
              { label: 'Yes', description: 'Continue.' },
              { label: 'No', description: 'Stop.' },
            ],
            multiSelect: false,
          },
        ],
      },
      { signal: new AbortController().signal },
    );
    await tick();
    const request = ws.framesOfType('question_request')[0];
    session.onFrame(
      frame({
        type: 'question_response',
        id: request.id,
        behavior: 'cancel',
      }),
    );
    await expect(pending).resolves.toMatchObject({ behavior: 'deny' });
  });

  it('still uses the approval modal for other tools', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: 'go' }));
    const canUseTool = captured[0].options['canUseTool'] as (
      toolName: string,
      input: Record<string, unknown>,
      opts: { signal: AbortSignal },
    ) => Promise<{ behavior: string }>;
    const pending = canUseTool(
      'write_file',
      { path: 'x' },
      { signal: new AbortController().signal },
    );
    await tick();
    const request = ws.framesOfType('permission_request')[0];
    session.onFrame(
      frame({
        type: 'permission_response',
        id: request.id,
        behavior: 'allow',
      }),
    );
    await expect(pending).resolves.toMatchObject({ behavior: 'allow' });
  });
});
