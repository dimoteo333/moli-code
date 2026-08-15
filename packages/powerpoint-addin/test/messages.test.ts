import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  parseFrame,
  serializeFrame,
  type UserMessageFrame,
} from '../src/shared/messages.js';
import {
  MAX_TEMPLATE_BYTES,
  MAX_WEBSOCKET_PAYLOAD_BYTES,
} from '../src/shared/attachment-limits.js';

describe('wire messages', () => {
  it('round-trips a user message with a local file', () => {
    const frame: UserMessageFrame = {
      v: PROTOCOL_VERSION,
      type: 'user_message',
      text: 'read @tasks.md',
      attachments: [
        {
          name: 'tasks.md',
          content: '# Tasks',
          size: 7,
          mimeType: 'text/markdown',
        },
      ],
    };
    expect(parseFrame(serializeFrame(frame))).toEqual(frame);
  });

  it('round-trips a base64 PowerPoint template attachment', () => {
    const frame: UserMessageFrame = {
      v: PROTOCOL_VERSION,
      type: 'user_message',
      text: '/template-report @template.pptx',
      attachments: [
        {
          name: 'template.pptx',
          content: 'UEsDBA==',
          size: 4,
          mimeType:
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          encoding: 'base64',
        },
      ],
    };

    expect(parseFrame(serializeFrame(frame))).toEqual(frame);
  });

  it('retains wire capacity for one base64-encoded 10 MiB template', () => {
    expect(MAX_TEMPLATE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_WEBSOCKET_PAYLOAD_BYTES).toBe(16 * 1024 * 1024);
    expect(Math.ceil((MAX_TEMPLATE_BYTES * 4) / 3)).toBeLessThan(
      MAX_WEBSOCKET_PAYLOAD_BYTES,
    );
  });

  it('rejects malformed frames and protocol versions', () => {
    expect(parseFrame('{bad')).toBeNull();
    expect(parseFrame('null')).toBeNull();
    expect(parseFrame(JSON.stringify({ v: 99, type: 'ping' }))).toBeNull();
  });
});
