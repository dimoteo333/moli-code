/** Shared limits, kept ES5-safe because the task pane imports this module. */
export const MAX_ATTACHED_FILES = 5;
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_FILE_CHARS = 256 * 1024;
export const MAX_TOTAL_FILE_CHARS = 512 * 1024;
export const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
export const MAX_WEBSOCKET_PAYLOAD_BYTES = 16 * 1024 * 1024;

export function attachmentReference(name: string): string {
  return '@' + name;
}

export function validAttachmentName(name: string): boolean {
  if (
    !name ||
    name.length > 180 ||
    name === '.' ||
    name === '..' ||
    /[/\\]/.test(name)
  ) {
    return false;
  }
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code < 32 || code === 127) return false;
  }
  return true;
}
