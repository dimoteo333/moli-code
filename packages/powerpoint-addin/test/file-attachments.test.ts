import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FILE_PICKER_ACCEPT,
  attachmentReference,
  attachmentSelectionError,
  isSupportedTextFile,
  readLocalFile,
  readLocalTextFile,
} from '../src/taskpane/file-attachments.js';
import {
  MAX_TEMPLATE_BYTES,
  MAX_TOTAL_FILE_CHARS,
} from '../src/shared/attachment-limits.js';
import type { LocalFileAttachment } from '../src/shared/messages.js';

class TestFileReader {
  result: string | ArrayBuffer | null = null;
  error: Error | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsText(file: File): void {
    void file.text().then(
      (content) => {
        this.result = content;
        if (this.onload) this.onload({} as ProgressEvent<FileReader>);
      },
      (error) => {
        this.error = error as Error;
        if (this.onerror) this.onerror({} as ProgressEvent<FileReader>);
      },
    );
  }

  readAsArrayBuffer(file: File): void {
    void file.arrayBuffer().then(
      (content) => {
        this.result = content;
        if (this.onload) this.onload({} as ProgressEvent<FileReader>);
      },
      (error) => {
        this.error = error as Error;
        if (this.onerror) this.onerror({} as ProgressEvent<FileReader>);
      },
    );
  }
}

const originalFileReader = globalThis.FileReader;

beforeEach(() => {
  globalThis.FileReader = TestFileReader as unknown as typeof FileReader;
});

afterEach(() => {
  globalThis.FileReader = originalFileReader;
});

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

  it('accepts PowerPoint templates but still rejects other binary formats', () => {
    expect(
      isSupportedTextFile(
        fakeFile(
          'deck.pptx',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ),
      ),
    ).toBe(false);
    expect(FILE_PICKER_ACCEPT).toContain('.pptx');
    expect(isSupportedTextFile(fakeFile('deck.docx'))).toBe(false);
  });

  it('accepts a pptx up to 10 MiB as base64', async () => {
    const file = new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
      'template.pptx',
      {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    );

    await expect(readLocalFile(file)).resolves.toMatchObject({
      name: 'template.pptx',
      content: 'UEsDBA==',
      encoding: 'base64',
      size: 4,
    });
  });

  it('converts a large pptx without spreading the whole byte array', async () => {
    const bytes = new Uint8Array(70_000);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 251;
    }

    const attachment = await readLocalFile(new File([bytes], 'template.pptx'));

    expect(attachment.content).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('rejects a pptx larger than 10 MiB', async () => {
    const file = new File(
      [new Uint8Array(MAX_TEMPLATE_BYTES + 1)],
      'large.pptx',
    );
    await expect(readLocalFile(file)).rejects.toThrow('FILE_TOO_LARGE');
  });

  it('keeps text attachments UTF-8 compatible with the old reader', async () => {
    const file = new File(['# Tasks'], 'tasks.md', {
      type: 'text/markdown',
    });

    const attachment = await readLocalTextFile(file);

    expect(attachment).toEqual({
      name: 'tasks.md',
      content: '# Tasks',
      size: 7,
      mimeType: 'text/markdown',
    });
  });

  it('counts template bytes separately and permits only one template', () => {
    const template: LocalFileAttachment = {
      name: 'template.pptx',
      content: 'A'.repeat(MAX_TOTAL_FILE_CHARS + 1),
      size: MAX_TEMPLATE_BYTES,
      encoding: 'base64',
    };
    expect(attachmentSelectionError([], template)).toBeNull();
    expect(
      attachmentSelectionError([template], {
        ...template,
        name: 'other.pptx',
      }),
    ).toBe('TOO_MANY_TEMPLATES');
    expect(
      attachmentSelectionError([], {
        name: 'large.md',
        content: 'x'.repeat(MAX_TOTAL_FILE_CHARS + 1),
        size: MAX_TOTAL_FILE_CHARS + 1,
      }),
    ).toBe('ATTACHMENTS_TOO_LARGE');
  });
});
