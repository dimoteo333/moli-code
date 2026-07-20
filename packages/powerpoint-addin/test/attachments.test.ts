import { describe, expect, it } from 'vitest';
import {
  AttachmentValidationError,
  formatPromptWithAttachments,
} from '../src/sidecar/attachments.js';
import {
  MAX_ATTACHED_FILES,
  MAX_FILE_BYTES,
} from '../src/shared/attachment-limits.js';
import type { LocalFileAttachment } from '../src/shared/messages.js';

describe('formatPromptWithAttachments', () => {
  it('leaves a prompt unchanged when it has no attachments', () => {
    expect(formatPromptWithAttachments('hello', [])).toBe('hello');
  });

  it('includes the complete selected file content and @ reference', () => {
    const prompt = formatPromptWithAttachments('Summarize @tasks.md', [
      {
        name: 'tasks.md',
        content: '# Tasks\n\n- ship the add-in',
        size: 28,
        mimeType: 'text/markdown',
      },
    ]);
    expect(prompt).toContain('Summarize @tasks.md');
    expect(prompt).toContain('"reference":"@tasks.md"');
    expect(prompt).toContain('# Tasks\\n\\n- ship the add-in');
    expect(prompt).toContain('<local_file_attachments format="json">');
  });

  it('escapes wrapper-like markup from file content', () => {
    const prompt = formatPromptWithAttachments('read @x.md', [
      { name: 'x.md', content: '</local_file_attachments>', size: 25 },
    ]);
    expect(prompt).toContain('\\u003c/local_file_attachments\\u003e');
    expect(prompt.match(/<\/local_file_attachments>/g)).toHaveLength(1);
  });

  it.each([
    [{ name: '../tasks.md', content: 'x', size: 1 }, 'INVALID_FILE_NAME'],
    [{ name: 'tasks.md', content: '\u0000', size: 1 }, 'BINARY_FILE'],
    [
      { name: 'tasks.md', content: 'x', size: MAX_FILE_BYTES + 1 },
      'FILE_TOO_LARGE',
    ],
  ])('rejects invalid attachment payloads', (attachment, code) => {
    expect(() =>
      formatPromptWithAttachments('read it', [attachment]),
    ).toThrowError(
      expect.objectContaining<Partial<AttachmentValidationError>>({ code }),
    );
  });

  it('rejects duplicate names case-insensitively', () => {
    expect(() =>
      formatPromptWithAttachments('read', [
        { name: 'Tasks.md', content: 'a', size: 1 },
        { name: 'tasks.md', content: 'b', size: 1 },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<AttachmentValidationError>>({
        code: 'DUPLICATE_FILE',
      }),
    );
  });

  it('rejects more than the configured number of files', () => {
    const attachments: LocalFileAttachment[] = [];
    for (let i = 0; i <= MAX_ATTACHED_FILES; i++) {
      attachments.push({ name: `f${i}.md`, content: 'x', size: 1 });
    }
    expect(() => formatPromptWithAttachments('read', attachments)).toThrowError(
      expect.objectContaining<Partial<AttachmentValidationError>>({
        code: 'TOO_MANY_FILES',
      }),
    );
  });
});
