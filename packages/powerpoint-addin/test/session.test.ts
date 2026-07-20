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
}

const captured: CapturedQuery[] = [];
const generatePowerPointReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue('C:\\reports\\meeting-report.pptx'),
);

vi.mock('../src/sidecar/report-generator.js', () => ({
  isReportCommand: (text: string) => /^\/report(?:\s|$)/i.test(text.trim()),
  generatePowerPointReport,
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
      captured.push({ prompt, options, interrupt });
      return {
        initialized: Promise.resolve(),
        interrupt,
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<SDKMessage>> {
              return new Promise(() => undefined);
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

beforeEach(() => {
  captured.length = 0;
  generatePowerPointReport.mockClear();
});

describe('PowerPoint PaneSession', () => {
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
