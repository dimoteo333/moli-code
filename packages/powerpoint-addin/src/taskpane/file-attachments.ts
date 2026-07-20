import {
  MAX_ATTACHED_FILES,
  MAX_FILE_BYTES,
  MAX_FILE_CHARS,
  MAX_TEMPLATE_BYTES,
  MAX_TOTAL_FILE_CHARS,
  attachmentReference,
  validAttachmentName,
} from '../shared/attachment-limits.js';
import type { LocalFileAttachment } from '../shared/messages.js';

const TEXT_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.csv',
  '.tsv',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.sql',
  '.properties',
  '.ini',
  '.cfg',
  '.log',
];

const POWERPOINT_EXTENSION = '.pptx';

export const FILE_PICKER_ACCEPT =
  TEXT_EXTENSIONS.join(',') + ',' + POWERPOINT_EXTENSION;

function isPowerPointTemplate(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.slice(-POWERPOINT_EXTENSION.length) === POWERPOINT_EXTENSION;
}

export function isSupportedTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  for (let i = 0; i < TEXT_EXTENSIONS.length; i++) {
    if (name.slice(-TEXT_EXTENSIONS[i].length) === TEXT_EXTENSIONS[i]) {
      return true;
    }
  }
  return (
    file.type.indexOf('text/') === 0 ||
    file.type === 'application/json' ||
    file.type === 'application/xml' ||
    file.type === 'application/javascript'
  );
}

export function readLocalTextFile(file: File): Promise<LocalFileAttachment> {
  if (!validAttachmentName(file.name)) {
    return Promise.reject(new Error('INVALID_FILE_NAME'));
  }
  if (!isSupportedTextFile(file)) {
    return Promise.reject(new Error('UNSUPPORTED_TYPE'));
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error('FILE_TOO_LARGE'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = function () {
      reject(new Error('READ_FAILED'));
    };
    reader.onload = function () {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (content.length > MAX_FILE_CHARS) {
        reject(new Error('FILE_TOO_LARGE'));
        return;
      }
      if (content.indexOf('\u0000') >= 0) {
        reject(new Error('BINARY_FILE'));
        return;
      }
      resolve({
        name: file.name,
        content,
        size: file.size,
        mimeType: file.type || undefined,
      });
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    for (let index = offset; index < end; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
  }
  return btoa(binary);
}

function readPowerPointTemplate(file: File): Promise<LocalFileAttachment> {
  if (file.size > MAX_TEMPLATE_BYTES) {
    return Promise.reject(new Error('FILE_TOO_LARGE'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = function () {
      reject(new Error('READ_FAILED'));
    };
    reader.onload = function () {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('READ_FAILED'));
        return;
      }
      resolve({
        name: file.name,
        content: bytesToBase64(new Uint8Array(reader.result)),
        size: file.size,
        mimeType: file.type || undefined,
        encoding: 'base64',
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

export function readLocalFile(file: File): Promise<LocalFileAttachment> {
  if (!validAttachmentName(file.name)) {
    return Promise.reject(new Error('INVALID_FILE_NAME'));
  }
  if (isPowerPointTemplate(file)) {
    return readPowerPointTemplate(file);
  }
  return readLocalTextFile(file);
}

export type AttachmentSelectionError =
  | 'TOO_MANY_FILES'
  | 'TOO_MANY_TEMPLATES'
  | 'ATTACHMENTS_TOO_LARGE';

export function attachmentSelectionError(
  existing: LocalFileAttachment[],
  candidate: LocalFileAttachment,
): AttachmentSelectionError | null {
  let textChars = 0;
  let templateCount = 0;
  let replacesExisting = false;
  const candidateName = candidate.name.toLowerCase();

  for (let index = 0; index < existing.length; index += 1) {
    const attachment = existing[index];
    if (attachment.name.toLowerCase() === candidateName) {
      replacesExisting = true;
      continue;
    }
    if (attachment.encoding === 'base64') {
      templateCount += 1;
    } else {
      textChars += attachment.content.length;
    }
  }

  if (!replacesExisting && existing.length >= MAX_ATTACHED_FILES) {
    return 'TOO_MANY_FILES';
  }
  if (candidate.encoding === 'base64') {
    return templateCount > 0 ? 'TOO_MANY_TEMPLATES' : null;
  }
  return textChars + candidate.content.length > MAX_TOTAL_FILE_CHARS
    ? 'ATTACHMENTS_TOO_LARGE'
    : null;
}

export { attachmentReference };
