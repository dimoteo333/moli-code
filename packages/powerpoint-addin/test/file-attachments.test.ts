import { describe, expect, it } from 'vitest';
import {
  attachmentReference,
  isSupportedTextFile,
} from '../src/taskpane/file-attachments.js';

function fakeFile(name: string, type = ''): File {
  return { name, type } as File;
}

describe('file attachment picker helpers', () => {
  it('creates the inline @filename reference', () => {
    expect(attachmentReference('tasks.md')).toBe('@tasks.md');
  });

  it('accepts Markdown and common text formats', () => {
    expect(isSupportedTextFile(fakeFile('tasks.md'))).toBe(true);
    expect(isSupportedTextFile(fakeFile('data.unknown', 'text/plain'))).toBe(
      true,
    );
    expect(isSupportedTextFile(fakeFile('slides.json'))).toBe(true);
  });

  it('rejects binary document formats', () => {
    expect(
      isSupportedTextFile(
        fakeFile(
          'deck.pptx',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ),
      ),
    ).toBe(false);
  });
});
