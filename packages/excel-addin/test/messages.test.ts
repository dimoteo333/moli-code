import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  parseFrame,
  serializeFrame,
  type UserMessageFrame,
} from '../src/shared/messages.js';

describe('parseFrame', () => {
  it('parses a valid frame', () => {
    const frame: UserMessageFrame = {
      v: PROTOCOL_VERSION,
      type: 'user_message',
      text: '안녕하세요',
    };
    const parsed = parseFrame(serializeFrame(frame));
    expect(parsed).toEqual(frame);
  });

  it('rejects malformed JSON', () => {
    expect(parseFrame('{nope')).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(parseFrame('"hello"')).toBeNull();
    expect(parseFrame('42')).toBeNull();
    expect(parseFrame('null')).toBeNull();
  });

  it('rejects wrong protocol version', () => {
    expect(parseFrame(JSON.stringify({ v: 99, type: 'ping' }))).toBeNull();
  });

  it('rejects missing type', () => {
    expect(parseFrame(JSON.stringify({ v: PROTOCOL_VERSION }))).toBeNull();
  });
});
