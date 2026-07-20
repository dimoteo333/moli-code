import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  parseFrame,
  serializeFrame,
  type UserMessageFrame,
} from '../src/shared/messages.js';

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

  it('rejects malformed frames and protocol versions', () => {
    expect(parseFrame('{bad')).toBeNull();
    expect(parseFrame('null')).toBeNull();
    expect(parseFrame(JSON.stringify({ v: 99, type: 'ping' }))).toBeNull();
  });
});
