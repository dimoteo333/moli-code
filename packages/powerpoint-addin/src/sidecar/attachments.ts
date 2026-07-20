import {
  MAX_ATTACHED_FILES,
  MAX_FILE_BYTES,
  MAX_FILE_CHARS,
  MAX_TOTAL_FILE_CHARS,
  attachmentReference,
  validAttachmentName,
} from '../shared/attachment-limits.js';
import type { LocalFileAttachment } from '../shared/messages.js';

export class AttachmentValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AttachmentValidationError';
  }
}

export function formatPromptWithAttachments(
  text: string,
  attachments: LocalFileAttachment[] | undefined,
): string {
  if (!attachments || attachments.length === 0) {
    return text;
  }
  if (attachments.length > MAX_ATTACHED_FILES) {
    throw new AttachmentValidationError(
      'TOO_MANY_FILES',
      `첨부 파일은 최대 ${MAX_ATTACHED_FILES}개까지 보낼 수 있습니다.`,
    );
  }

  let totalChars = 0;
  const seenNames = new Set<string>();
  const payload: Array<{
    reference: string;
    name: string;
    mimeType: string;
    size: number;
    content: string;
  }> = [];

  for (const attachment of attachments) {
    if (
      !attachment ||
      typeof attachment.name !== 'string' ||
      typeof attachment.content !== 'string' ||
      typeof attachment.size !== 'number' ||
      !Number.isFinite(attachment.size) ||
      attachment.size < 0
    ) {
      throw new AttachmentValidationError(
        'INVALID_FILE',
        '첨부 파일 정보가 올바르지 않습니다.',
      );
    }
    if (!validAttachmentName(attachment.name)) {
      throw new AttachmentValidationError(
        'INVALID_FILE_NAME',
        '첨부 파일 이름이 올바르지 않습니다.',
      );
    }
    const key = attachment.name.toLocaleLowerCase('en-US');
    if (seenNames.has(key)) {
      throw new AttachmentValidationError(
        'DUPLICATE_FILE',
        `같은 이름의 파일을 두 번 첨부할 수 없습니다: ${attachment.name}`,
      );
    }
    seenNames.add(key);
    if (
      attachment.size > MAX_FILE_BYTES ||
      attachment.content.length > MAX_FILE_CHARS
    ) {
      throw new AttachmentValidationError(
        'FILE_TOO_LARGE',
        `첨부 파일이 너무 큽니다: ${attachment.name}`,
      );
    }
    if (attachment.content.indexOf('\u0000') >= 0) {
      throw new AttachmentValidationError(
        'BINARY_FILE',
        `텍스트 파일만 첨부할 수 있습니다: ${attachment.name}`,
      );
    }
    totalChars += attachment.content.length;
    if (totalChars > MAX_TOTAL_FILE_CHARS) {
      throw new AttachmentValidationError(
        'ATTACHMENTS_TOO_LARGE',
        '첨부 파일의 전체 내용이 512KB를 초과합니다.',
      );
    }
    payload.push({
      reference: attachmentReference(attachment.name),
      name: attachment.name,
      mimeType: attachment.mimeType || 'text/plain',
      size: attachment.size,
      content: attachment.content,
    });
  }

  // JSON preserves file contents exactly. Angle brackets are escaped so a
  // file cannot forge the wrapper delimiter in the serialized prompt.
  const serialized = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  return (
    text +
    '\n\n<local_file_attachments format="json">\n' +
    '사용자가 직접 선택한 로컬 텍스트 파일입니다. reference는 메시지의 @파일명과 대응하며 content가 파일의 전체 내용입니다.\n' +
    serialized +
    '\n</local_file_attachments>'
  );
}
