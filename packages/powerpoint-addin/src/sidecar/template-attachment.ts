import { randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import {
  basename,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import {
  MAX_TEMPLATE_BYTES,
  validAttachmentName,
} from '../shared/attachment-limits.js';
import type { LocalFileAttachment } from '../shared/messages.js';

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export class TemplateAttachmentError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TemplateAttachmentError';
  }
}

function fail(code: string, message: string): never {
  throw new TemplateAttachmentError(code, message);
}

function isContained(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === '' ||
    (!isAbsolute(pathFromParent) &&
      pathFromParent !== '..' &&
      !pathFromParent.startsWith(`..${sep}`) &&
      !pathFromParent.startsWith('../'))
  );
}

function validateName(name: unknown): asserts name is string {
  const extension = typeof name === 'string' ? extname(name) : '';
  const stem = typeof name === 'string' ? name.slice(0, -extension.length) : '';
  if (
    typeof name !== 'string' ||
    !validAttachmentName(name) ||
    name !== name.trim() ||
    basename(name) !== name ||
    extension.toLocaleLowerCase('en-US') !== '.pptx' ||
    stem.trim().length === 0 ||
    /[<>:"|?*]/.test(name) ||
    /[. ]$/.test(name) ||
    WINDOWS_RESERVED_NAME.test(stem)
  ) {
    fail('TEMPLATE_NAME_INVALID', 'PPTX 템플릿 파일 이름이 올바르지 않습니다.');
  }
}

function decodeAttachment(attachment: LocalFileAttachment): Buffer {
  if (attachment.encoding !== 'base64') {
    fail(
      'TEMPLATE_ENCODING_INVALID',
      'PPTX 템플릿은 base64 형식이어야 합니다.',
    );
  }
  if (!Number.isSafeInteger(attachment.size) || attachment.size < 0) {
    fail('TEMPLATE_SIZE_INVALID', 'PPTX 템플릿 크기가 올바르지 않습니다.');
  }
  if (attachment.size > MAX_TEMPLATE_BYTES) {
    fail('TEMPLATE_TOO_LARGE', 'PPTX 템플릿은 10 MiB 이하여야 합니다.');
  }
  const content = attachment.content;
  if (
    typeof content !== 'string' ||
    content.length === 0 ||
    content.length % 4 !== 0 ||
    !BASE64_PATTERN.test(content)
  ) {
    fail(
      'TEMPLATE_BASE64_INVALID',
      'PPTX 템플릿의 base64 데이터가 올바르지 않습니다.',
    );
  }

  const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0;
  const decodedLength = (content.length / 4) * 3 - padding;
  if (decodedLength > MAX_TEMPLATE_BYTES) {
    fail('TEMPLATE_TOO_LARGE', 'PPTX 템플릿은 10 MiB 이하여야 합니다.');
  }
  if (decodedLength !== attachment.size) {
    fail(
      'TEMPLATE_SIZE_MISMATCH',
      '선언된 PPTX 템플릿 크기가 실제 데이터와 다릅니다.',
    );
  }

  const bytes = Buffer.from(content, 'base64');
  if (bytes.toString('base64') !== content) {
    fail(
      'TEMPLATE_BASE64_INVALID',
      'PPTX 템플릿의 base64 데이터가 올바르지 않습니다.',
    );
  }
  if (bytes.length !== attachment.size) {
    fail(
      'TEMPLATE_SIZE_MISMATCH',
      '선언된 PPTX 템플릿 크기가 실제 데이터와 다릅니다.',
    );
  }
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    fail(
      'TEMPLATE_SIGNATURE_INVALID',
      'PPTX 템플릿의 ZIP 서명이 올바르지 않습니다.',
    );
  }
  return bytes;
}

/**
 * Validates and stores a binary PPTX without exposing its content to a model
 * prompt. The returned path is always a newly created file under templates.
 */
export async function saveTemplateAttachment(
  attachment: LocalFileAttachment,
  workDir: string,
): Promise<string> {
  if (!attachment || typeof attachment !== 'object') {
    fail('TEMPLATE_ATTACHMENT_INVALID', 'PPTX 템플릿 첨부 정보가 없습니다.');
  }
  validateName(attachment.name);
  const bytes = decodeAttachment(attachment);

  if (typeof workDir !== 'string' || workDir.trim().length === 0) {
    fail('TEMPLATE_PATH_INVALID', '템플릿 작업 폴더가 올바르지 않습니다.');
  }

  const resolvedWorkDir = resolve(workDir);
  const templatesDir = resolve(resolvedWorkDir, 'templates');
  if (!isContained(resolvedWorkDir, templatesDir)) {
    fail(
      'TEMPLATE_PATH_INVALID',
      '템플릿 저장 경로가 작업 폴더 밖에 있습니다.',
    );
  }

  try {
    await mkdir(templatesDir, { recursive: true });
    const templatesStat = await lstat(templatesDir);
    if (!templatesStat.isDirectory() || templatesStat.isSymbolicLink()) {
      fail('TEMPLATE_PATH_INVALID', '템플릿 저장 폴더가 안전하지 않습니다.');
    }
    const [realWorkDir, realTemplatesDir] = await Promise.all([
      realpath(resolvedWorkDir),
      realpath(templatesDir),
    ]);
    if (!isContained(realWorkDir, realTemplatesDir)) {
      fail(
        'TEMPLATE_PATH_INVALID',
        '템플릿 저장 경로가 작업 폴더 밖에 있습니다.',
      );
    }
  } catch (error) {
    if (error instanceof TemplateAttachmentError) throw error;
    fail('TEMPLATE_PATH_INVALID', '템플릿 저장 폴더를 준비할 수 없습니다.');
  }

  const stem = attachment.name.slice(0, -extname(attachment.name).length);
  const destination = resolve(templatesDir, `${stem}-${randomUUID()}.pptx`);
  if (!isContained(templatesDir, destination)) {
    fail(
      'TEMPLATE_PATH_INVALID',
      '템플릿 저장 경로가 작업 폴더 밖에 있습니다.',
    );
  }
  try {
    await writeFile(destination, bytes, { flag: 'wx' });
  } catch (_error) {
    fail(
      'TEMPLATE_WRITE_FAILED',
      'PPTX 템플릿을 안전하게 저장하지 못했습니다.',
    );
  }
  return destination;
}
