import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SDKMessage, SDKUserMessage } from '@dobby/moli-code-sdk';
import {
  PROTOCOL_VERSION,
  parseFrame,
  type AnyFrame,
  type HelloFrame,
  type SidecarToPaneFrame,
} from '../src/shared/messages.js';

// --- SDK mock -------------------------------------------------------------

interface CapturedQuery {
  prompt: AsyncIterable<SDKUserMessage>;
  options: Record<string, unknown>;
  emit: (msg: SDKMessage) => void;
  finish: () => void;
  interrupt: ReturnType<typeof vi.fn>;
}

const captured: CapturedQuery[] = [];

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
      const buffer: SDKMessage[] = [];
      const waiters: Array<(r: IteratorResult<SDKMessage>) => void> = [];
      let done = false;
      const instance: CapturedQuery = {
        prompt,
        options,
        emit: (msg) => {
          const waiter = waiters.shift();
          if (waiter) {
            waiter({ value: msg, done: false });
          } else {
            buffer.push(msg);
          }
        },
        finish: () => {
          done = true;
          for (const waiter of waiters.splice(0)) {
            waiter({ value: undefined as never, done: true });
          }
        },
        interrupt: vi.fn().mockResolvedValue(undefined),
      };
      captured.push(instance);
      return {
        interrupt: instance.interrupt,
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<SDKMessage>> {
              const msg = buffer.shift();
              if (msg) {
                return Promise.resolve({ value: msg, done: false });
              }
              if (done) {
                return Promise.resolve({
                  value: undefined as never,
                  done: true,
                });
              }
              return new Promise((resolve) => waiters.push(resolve));
            },
          };
        },
      };
    },
  };
});

const { PaneSession } = await import('../src/sidecar/session.js');
const { Logger } = await import('../src/sidecar/logger.js');

// --- helpers ----------------------------------------------------------------

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
  requirementSets: { 'ExcelApi 1.1': true },
  uiLocale: 'ko-KR',
};

function makeSession(ws: FakeWs) {
  return new PaneSession(
    ws as never,
    hello,
    {
      port: 39215,
      version: 'test',
      config: {
        port: 39215,
        certPfxPath: '/dev/null',
        certPassphrase: '',
        workDir: `${process.env['TMPDIR'] ?? '/tmp'}/moli-excel-test-workspace`,
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

beforeEach(() => {
  captured.length = 0;
});

// --- tests ------------------------------------------------------------------

describe('PaneSession', () => {
  it('sends hello_ok on construction', () => {
    const ws = new FakeWs();
    makeSession(ws);
    expect(ws.sent[0]).toMatchObject({ type: 'hello_ok', version: 'test' });
  });

  it('starts the query lazily and feeds user messages into streaming input', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    expect(captured).toHaveLength(0);

    session.onFrame(frame({ type: 'user_message', text: '시트 요약해줘' }));
    expect(captured).toHaveLength(1);

    const iterator = captured[0].prompt[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);
    expect(first.value.message.content).toBe('시트 요약해줘');

    // Second message goes into the same session.
    session.onFrame(frame({ type: 'user_message', text: '계속' }));
    expect(captured).toHaveLength(1);
    const second = await iterator.next();
    expect(second.value.message.content).toBe('계속');
  });

  it('translates SDK messages into pane frames', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: 'go' }));
    const q = captured[0];

    q.emit({
      type: 'stream_event',
      uuid: 'u1',
      session_id: 's',
      parent_tool_use_id: null,
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: '안녕' },
      },
    });
    q.emit({
      type: 'assistant',
      uuid: 'u2',
      session_id: 's',
      parent_tool_use_id: null,
      message: {
        id: 'm1',
        type: 'message',
        role: 'assistant',
        model: 'test',
        usage: { input_tokens: 1, output_tokens: 1 },
        content: [
          { type: 'text', text: '안녕하세요' },
          {
            type: 'tool_use',
            id: 't1',
            name: 'excel_read_range',
            input: { range: 'A1' },
          },
        ],
      },
    } as never);
    q.emit({
      type: 'user',
      session_id: 's',
      parent_tool_use_id: null,
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }],
      },
    } as never);
    q.emit({
      type: 'result',
      subtype: 'success',
      uuid: 'u3',
      session_id: 's',
      is_error: false,
      duration_ms: 1,
      duration_api_ms: 1,
      num_turns: 1,
      result: 'done',
      usage: {},
      permission_denials: [],
    } as never);
    await tick();

    expect(ws.framesOfType('assistant_delta')).toMatchObject([
      { text: '안녕' },
    ]);
    expect(ws.framesOfType('assistant_message')).toMatchObject([
      { blocks: [{ type: 'text', text: '안녕하세요' }] },
    ]);
    expect(ws.framesOfType('tool_activity')).toMatchObject([
      { toolName: 'excel_read_range', status: 'start' },
      { toolName: 'excel_read_range', status: 'end', isError: false },
    ]);
    expect(ws.framesOfType('turn_complete')).toMatchObject([
      { isError: false },
    ]);
  });

  it('auto-approves read-only excel tools and prompts for writes', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: 'go' }));
    const canUseTool = captured[0].options['canUseTool'] as (
      toolName: string,
      input: Record<string, unknown>,
      opts: { signal: AbortSignal },
    ) => Promise<{ behavior: string }>;

    const readResult = await canUseTool(
      'mcp__excel__excel_read_range',
      { range: 'A1' },
      { signal: new AbortController().signal },
    );
    expect(readResult.behavior).toBe('allow');
    expect(ws.framesOfType('permission_request')).toHaveLength(0);

    const writePromise = canUseTool(
      'mcp__excel__excel_write_range',
      { range: 'A1', values: [[1]] },
      { signal: new AbortController().signal },
    );
    await tick();
    const requests = ws.framesOfType('permission_request');
    expect(requests).toHaveLength(1);

    session.onFrame(
      frame({
        type: 'permission_response',
        id: requests[0].id,
        behavior: 'allow',
        alwaysAllow: true,
      }),
    );
    const writeResult = await writePromise;
    expect(writeResult.behavior).toBe('allow');

    // alwaysAllow: the same tool no longer prompts.
    const again = await canUseTool(
      'mcp__excel__excel_write_range',
      { range: 'A2', values: [[2]] },
      { signal: new AbortController().signal },
    );
    expect(again.behavior).toBe('allow');
    expect(ws.framesOfType('permission_request')).toHaveLength(1);
  });

  it('denies pending permissions and rejects rpc calls on dispose', async () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: 'go' }));
    const canUseTool = captured[0].options['canUseTool'] as (
      toolName: string,
      input: Record<string, unknown>,
      opts: { signal: AbortSignal },
    ) => Promise<{ behavior: string; message?: string }>;

    const pendingPermission = canUseTool(
      'excel_write_range',
      {},
      { signal: new AbortController().signal },
    );
    await tick();
    session.dispose('pane disconnected');
    await expect(pendingPermission).resolves.toMatchObject({
      behavior: 'deny',
    });
  });

  it('forwards interrupt to the query', () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'user_message', text: 'go' }));
    session.onFrame(frame({ type: 'interrupt' }));
    expect(captured[0].interrupt).toHaveBeenCalled();
  });

  it('answers ping with pong without starting a query', () => {
    const ws = new FakeWs();
    const session = makeSession(ws);
    session.onFrame(frame({ type: 'ping' }));
    expect(ws.framesOfType('pong')).toHaveLength(1);
    expect(captured).toHaveLength(0);
  });
});
