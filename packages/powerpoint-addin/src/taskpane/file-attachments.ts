import {
  MAX_FILE_BYTES,
  MAX_FILE_CHARS,
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

export const FILE_PICKER_ACCEPT = TEXT_EXTENSIONS.join(',');

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

export { attachmentReference };
