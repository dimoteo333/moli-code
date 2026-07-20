import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_TEMPLATE_BYTES } from '../src/shared/attachment-limits.js';
import type { LocalFileAttachment } from '../src/shared/messages.js';
import { saveTemplateAttachment } from '../src/sidecar/template-attachment.js';

const fileSystemRace = vi.hoisted(() => ({ destinationRealpath: '' }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    realpath: vi.fn(async (path: Parameters<typeof actual.realpath>[0]) => {
      if (fileSystemRace.destinationRealpath && /\.pptx$/i.test(String(path))) {
        return fileSystemRace.destinationRealpath;
      }
      return actual.realpath(path);
    }),
  };
});

const pptxBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);

function attachment(
  overrides: Partial<LocalFileAttachment> = {},
): LocalFileAttachment {
  return {
    name: '제출양식.pptx',
    content: pptxBytes.toString('base64'),
    size: pptxBytes.length,
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    encoding: 'base64',
    ...overrides,
  };
}

const invalidAttachments: Array<
  [string, Partial<LocalFileAttachment>, string]
> = [
  ['non-base64 encoding', { encoding: 'utf8' }, 'TEMPLATE_ENCODING_INVALID'],
  ['bad base64 alphabet', { content: '***=====' }, 'TEMPLATE_BASE64_INVALID'],
  ['non-canonical base64', { content: 'UEsDBA' }, 'TEMPLATE_BASE64_INVALID'],
  [
    'declared size mismatch',
    { size: pptxBytes.length + 1 },
    'TEMPLATE_SIZE_MISMATCH',
  ],
  [
    'declared size above limit',
    { size: MAX_TEMPLATE_BYTES + 1 },
    'TEMPLATE_TOO_LARGE',
  ],
  [
    'decoded size above limit',
    {
      content: Buffer.alloc(MAX_TEMPLATE_BYTES + 1, 0x50).toString('base64'),
      size: MAX_TEMPLATE_BYTES + 1,
    },
    'TEMPLATE_TOO_LARGE',
  ],
  [
    'bad ZIP signature',
    {
      content: Buffer.from('not-a-zip').toString('base64'),
      size: Buffer.byteLength('not-a-zip'),
    },
    'TEMPLATE_SIGNATURE_INVALID',
  ],
  ['path traversal', { name: '../x.pptx' }, 'TEMPLATE_NAME_INVALID'],
  ['wrong extension', { name: 'template.zip' }, 'TEMPLATE_NAME_INVALID'],
  ['blank stem', { name: ' .pptx' }, 'TEMPLATE_NAME_INVALID'],
  ['Windows device name', { name: 'CON.pptx' }, 'TEMPLATE_NAME_INVALID'],
];

describe('saveTemplateAttachment', () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    fileSystemRace.destinationRealpath = '';
    await Promise.all(
      cleanup
        .splice(0)
        .map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  async function temporaryWorkDir(): Promise<string> {
    const path = await mkdtemp(resolve(tmpdir(), 'moli-ppt-template-'));
    cleanup.push(path);
    return path;
  }

  it('stores valid PPTX bytes in a unique file below workDir/templates', async () => {
    const workDir = await temporaryWorkDir();
    const first = await saveTemplateAttachment(attachment(), workDir);
    const second = await saveTemplateAttachment(attachment(), workDir);
    const templatesDir = resolve(workDir, 'templates');

    expect(relative(templatesDir, first)).not.toMatch(/^\.\.(?:[\\/]|$)/);
    expect(first).not.toBe(second);
    await expect(readFile(first)).resolves.toEqual(pptxBytes);
    await expect(readFile(second)).resolves.toEqual(pptxBytes);
  });

  it.each(invalidAttachments)('rejects %s', async (_label, overrides, code) => {
    const workDir = await temporaryWorkDir();
    await expect(
      saveTemplateAttachment(attachment(overrides), workDir),
    ).rejects.toMatchObject({ code });
  });

  it('rejects a templates directory that is not a directory', async () => {
    const workDir = await temporaryWorkDir();
    const templatesPath = resolve(workDir, 'templates');
    await mkdir(dirname(templatesPath), { recursive: true });
    await writeFile(templatesPath, 'occupied');

    await expect(
      saveTemplateAttachment(attachment(), workDir),
    ).rejects.toMatchObject({
      code: 'TEMPLATE_PATH_INVALID',
    });
  });

  it('rejects an empty work directory', async () => {
    await expect(
      saveTemplateAttachment(attachment(), '  '),
    ).rejects.toMatchObject({
      code: 'TEMPLATE_PATH_INVALID',
    });
  });

  it('rejects and cleans its own file when the destination resolves outside after writing', async () => {
    const workDir = await temporaryWorkDir();
    fileSystemRace.destinationRealpath = resolve(
      workDir,
      '..',
      'replaced',
      'template.pptx',
    );

    await expect(
      saveTemplateAttachment(attachment(), workDir),
    ).rejects.toMatchObject({ code: 'TEMPLATE_PATH_RACE' });
    await expect(readdir(resolve(workDir, 'templates'))).resolves.toEqual([]);
  });
});
