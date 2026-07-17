/**
 * Plain-DOM chat UI (ES5, IE11-safe): user bubbles, streamed assistant
 * markdown text, tool-activity chips, live progress busy bar, status bar,
 * input row with a "selected range" attachment.
 */

import { STRINGS, toolLabel } from './strings.ko.js';
import { renderMarkdownInto } from './markdown.js';

export interface SelectionAttachment {
  address: string;
  values?: unknown[][];
}

export interface ChatUiCallbacks {
  /** `wireText` includes the attachment payload; the bubble shows the raw input. */
  onSend: (wireText: string) => void;
  onStop: () => void;
  /** Reads the workbook's current selection; absent in degraded modes. */
  onGetSelection?: () => Promise<SelectionAttachment>;
}

export interface ChatUi {
  addUserMessage(text: string): void;
  appendAssistantDelta(turnId: number, text: string): void;
  finalizeAssistantMessage(turnId: number, fullText: string): void;
  showThinking(turnId: number, text: string): void;
  addToolChip(
    turnId: number,
    toolName: string,
    status: 'start' | 'end',
    isError?: boolean,
    summary?: string,
  ): void;
  turnComplete(isError?: boolean, errorMessage?: string): void;
  setStatus(text: string, kind: 'ok' | 'busy' | 'bad'): void;
  setBusy(busy: boolean): void;
  showFatal(message: string): void;
  addSystemNote(text: string): void;
}

const STREAM_RENDER_DELAY_MS = 80;
const MAX_ATTACH_CELLS = 400;
const MAX_ATTACH_CHARS = 4000;

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (parent) {
    parent.appendChild(node);
  }
  return node;
}

/** Short human hint from a tool-input JSON preview (range, sheet, ...). */
function toolDetail(summary: string): string {
  let detail = '';
  try {
    const input = JSON.parse(summary) as { [key: string]: unknown };
    const keys = ['range', 'sheet', 'name', 'query'];
    const parts: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const value = input[keys[i]];
      if (typeof value === 'string' && value) {
        parts.push(value);
      }
    }
    detail = parts.join(' ');
  } catch (_e) {
    detail = summary;
  }
  if (detail.length > 40) {
    detail = detail.slice(0, 40) + '…';
  }
  return detail;
}

/** Flatten attachment values to tab-separated text (capped). */
function attachmentBody(att: SelectionAttachment): string {
  if (!att.values || att.values.length === 0) {
    return '';
  }
  let cells = 0;
  const rows: string[] = [];
  for (let r = 0; r < att.values.length; r++) {
    const row = att.values[r];
    const cols: string[] = [];
    for (let c = 0; c < row.length; c++) {
      cells++;
      const v = row[c];
      cols.push(
        v === null || v === undefined
          ? ''
          : String(v).replace(/[\t\r\n]+/g, ' '),
      );
    }
    rows.push(cols.join('\t'));
  }
  const body = rows.join('\n');
  if (cells > MAX_ATTACH_CELLS || body.length > MAX_ATTACH_CHARS) {
    return '(범위가 커서 값은 생략했습니다. excel_read_range 도구로 읽어 주세요.)';
  }
  return body;
}

export function createChatUi(
  root: HTMLElement,
  callbacks: ChatUiCallbacks,
): ChatUi {
  root.innerHTML = '';

  const header = el('div', 'mc-header', root);
  const logo = document.createElement('img');
  logo.className = 'mc-logo';
  logo.src = 'assets/icon-64.png';
  logo.alt = '';
  header.appendChild(logo);
  const titleBox = el('div', 'mc-title-box', header);
  el('div', 'mc-title', titleBox).textContent = STRINGS.appTitle;
  el('div', 'mc-subtitle', titleBox).textContent = STRINGS.appSubtitle;
  const statusDot = el('span', 'mc-status-dot busy', header);
  const statusText = el('span', 'mc-status-text', header);
  statusText.textContent = STRINGS.statusConnecting;

  const messages = el('div', 'mc-messages', root);

  const busyBar = el('div', 'mc-busy', root);
  el('span', 'mc-spinner', busyBar);
  const busyLabel = el('span', 'mc-busy-label', busyBar);
  busyLabel.textContent = STRINGS.working;
  const busyElapsed = el('span', 'mc-busy-elapsed', busyBar);
  const stopBtn = el('button', 'mc-stop-btn', busyBar) as HTMLButtonElement;
  stopBtn.textContent = STRINGS.stop;
  stopBtn.onclick = function () {
    callbacks.onStop();
  };
  busyBar.style.display = 'none';

  // Attachment pill row (hidden until a selection is attached).
  const attachRow = el('div', 'mc-attach-row', root);
  attachRow.style.display = 'none';

  const inputRow = el('div', 'mc-input-row', root);
  let attachBtn: HTMLButtonElement | null = null;
  if (callbacks.onGetSelection) {
    attachBtn = el('button', 'mc-attach-btn', inputRow) as HTMLButtonElement;
    attachBtn.textContent = '📌';
    attachBtn.title = STRINGS.attachSelection;
  }
  const input = el('textarea', 'mc-input', inputRow) as HTMLTextAreaElement;
  input.setAttribute('placeholder', STRINGS.inputPlaceholder);
  input.setAttribute('rows', '2');
  const sendBtn = el('button', 'mc-send-btn', inputRow) as HTMLButtonElement;
  sendBtn.textContent = STRINGS.send;

  let busy = false;
  let busyStart = 0;
  let busyTimer: number | null = null;
  // Live thinking box (one per contiguous thinking segment).
  let thinkingNode: HTMLElement | null = null;
  let thinkingBody: HTMLElement | null = null;
  let thinkingTurnId = -1;
  // One streaming bubble per turn.
  let streamTurnId = -1;
  let streamNode: HTMLElement | null = null;
  let streamRaw = '';
  let streamRenderTimer: number | null = null;
  // Selection snapshots referenced by inline tokens in the prompt text.
  const attachments: SelectionAttachment[] = [];

  function scrollDown(): void {
    messages.scrollTop = messages.scrollHeight;
  }

  function selectionToken(address: string): string {
    return '[' + STRINGS.attachedRange + ': ' + address + ']';
  }

  /** Insert text into the prompt at the caret (append when unsupported). */
  function insertAtCursor(text: string): void {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number') {
      input.value = input.value.slice(0, start) + text + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + text.length;
    } else {
      input.value += text;
    }
    input.focus();
  }

  function makeRemoveHandler(address: string): () => void {
    return function () {
      removeAttachment(address);
    };
  }

  function renderAttachments(): void {
    attachRow.innerHTML = '';
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const pill = el('span', 'mc-attach-pill', attachRow);
      el('span', 'mc-attach-pill-text', pill).textContent = '📌 ' + att.address;
      const remove = el(
        'button',
        'mc-attach-remove',
        pill,
      ) as HTMLButtonElement;
      remove.textContent = '×';
      remove.title = STRINGS.removeAttachment;
      remove.onclick = makeRemoveHandler(att.address);
    }
    attachRow.style.display = attachments.length > 0 ? '' : 'none';
  }

  function removeAttachment(address: string): void {
    for (let i = attachments.length - 1; i >= 0; i--) {
      if (attachments[i].address === address) {
        attachments.splice(i, 1);
      }
    }
    // Strip its token(s) from the prompt text too.
    const token = selectionToken(address);
    while (input.value.indexOf(token) >= 0) {
      input.value = input.value.replace(token, '');
    }
    renderAttachments();
  }

  function addAttachment(selection: SelectionAttachment): void {
    insertAtCursor(selectionToken(selection.address));
    for (let i = 0; i < attachments.length; i++) {
      if (attachments[i].address === selection.address) {
        attachments[i] = selection; // refresh the snapshot
        renderAttachments();
        return;
      }
    }
    attachments.push(selection);
    renderAttachments();
  }

  if (attachBtn) {
    attachBtn.onclick = function () {
      if (!callbacks.onGetSelection || attachBtn!.disabled) {
        return;
      }
      attachBtn!.disabled = true;
      callbacks.onGetSelection().then(
        (selection) => {
          attachBtn!.disabled = false;
          if (selection && selection.address) {
            addAttachment(selection);
          } else {
            api.addSystemNote(STRINGS.attachFailed);
          }
        },
        () => {
          attachBtn!.disabled = false;
          api.addSystemNote(STRINGS.attachFailed);
        },
      );
    };
  }

  function updateElapsed(): void {
    const seconds = Math.floor((new Date().getTime() - busyStart) / 1000);
    busyElapsed.textContent =
      seconds > 0 ? seconds + STRINGS.secondsSuffix : '';
  }

  function setBusyLabel(text: string): void {
    busyLabel.textContent = text;
  }

  function submit(): void {
    const text = input.value.replace(/^\s+|\s+$/g, '');
    if (!text || busy) {
      return;
    }
    input.value = '';
    // Tokens sit inline in the prompt; append the captured cell values for
    // every token still present (a token deleted by hand sends no data).
    let wireText = text;
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      if (text.indexOf(selectionToken(att.address)) < 0) {
        continue;
      }
      const body = attachmentBody(att);
      if (body) {
        wireText +=
          '\n\n[' +
          STRINGS.attachedRange +
          ' 값: ' +
          att.address +
          ']\n' +
          body;
      }
    }
    attachments.length = 0;
    renderAttachments();
    api.addUserMessage(text);
    api.setBusy(true);
    callbacks.onSend(wireText);
  }

  sendBtn.onclick = submit;
  input.onkeydown = function (event) {
    const e = event || (window.event as KeyboardEvent);
    if (e.keyCode === 13 && !e.shiftKey) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      submit();
      return false;
    }
    return true;
  };

  function bubble(className: string): HTMLElement {
    const wrap = el('div', 'mc-msg ' + className, messages);
    scrollDown();
    return wrap;
  }

  function getStreamNode(turnId: number): HTMLElement {
    if (streamNode && streamTurnId === turnId) {
      return streamNode;
    }
    streamTurnId = turnId;
    streamNode = bubble('assistant');
    streamRaw = '';
    return streamNode;
  }

  function cancelStreamRender(): void {
    if (streamRenderTimer !== null) {
      window.clearTimeout(streamRenderTimer);
      streamRenderTimer = null;
    }
  }

  function scheduleStreamRender(): void {
    if (streamRenderTimer !== null) {
      return;
    }
    streamRenderTimer = window.setTimeout(() => {
      streamRenderTimer = null;
      if (streamNode) {
        renderMarkdownInto(streamNode, streamRaw);
        scrollDown();
      }
    }, STREAM_RENDER_DELAY_MS);
  }

  function closeStream(): void {
    cancelStreamRender();
    if (streamNode && streamRaw) {
      renderMarkdownInto(streamNode, streamRaw);
    }
    streamNode = null;
    streamTurnId = -1;
    streamRaw = '';
  }

  function makeThinkingToggle(body: HTMLElement): () => void {
    return function () {
      body.style.display = body.style.display === 'none' ? '' : 'none';
    };
  }

  /** Collapse the live thinking box once real output takes over. */
  function closeThinkingBox(): void {
    if (!thinkingNode) {
      return;
    }
    const headers = thinkingNode.getElementsByClassName('mc-thinking-header');
    if (headers.length > 0) {
      (headers[0] as HTMLElement).textContent = '💭 ' + STRINGS.thinkingDone;
    }
    if (thinkingBody) {
      thinkingBody.style.display = 'none';
    }
    thinkingNode.className += ' done';
    thinkingNode = null;
    thinkingBody = null;
    thinkingTurnId = -1;
  }

  const api: ChatUi = {
    addUserMessage(text) {
      bubble('user').textContent = text;
      scrollDown();
    },
    appendAssistantDelta(turnId, text) {
      closeThinkingBox();
      getStreamNode(turnId);
      streamRaw += text;
      setBusyLabel(STRINGS.working);
      scheduleStreamRender();
    },
    finalizeAssistantMessage(turnId, fullText) {
      const node = getStreamNode(turnId);
      cancelStreamRender();
      renderMarkdownInto(node, fullText);
      // Next assistant output in the same turn opens a fresh bubble
      // (tool calls interleave between text blocks).
      streamNode = null;
      streamTurnId = -1;
      streamRaw = '';
      scrollDown();
    },
    showThinking(turnId, text) {
      if (!thinkingNode || thinkingTurnId !== turnId) {
        closeThinkingBox();
        thinkingTurnId = turnId;
        thinkingNode = bubble('thinking');
        const header = el('div', 'mc-thinking-header', thinkingNode);
        header.textContent = '💭 ' + STRINGS.thinkingLive;
        thinkingBody = el('div', 'mc-thinking-body', thinkingNode);
        header.onclick = makeThinkingToggle(thinkingBody);
      }
      if (thinkingBody) {
        thinkingBody.textContent = (thinkingBody.textContent || '') + text;
        thinkingBody.scrollTop = thinkingBody.scrollHeight;
      }
      setBusyLabel(STRINGS.thinking);
      scrollDown();
    },
    addToolChip(turnId, toolName, status, isError, summary) {
      closeStream();
      closeThinkingBox();
      const label = toolLabel(toolName);
      if (status === 'start') {
        const chip = bubble('tool');
        chip.setAttribute('data-tool', toolName);
        const detail = summary ? toolDetail(summary) : '';
        if (detail) {
          chip.setAttribute('data-detail', detail);
        }
        chip.textContent =
          '⚙ ' +
          label +
          (detail ? ' (' + detail + ')' : '') +
          ' — ' +
          STRINGS.toolRunning;
        setBusyLabel(label + ' ' + STRINGS.toolRunning);
      } else {
        // Update the most recent open chip for this tool.
        const chips = messages.getElementsByClassName('mc-msg tool');
        for (let i = chips.length - 1; i >= 0; i--) {
          const candidate = chips[i] as HTMLElement;
          if (
            candidate.getAttribute('data-tool') === toolName &&
            !candidate.getAttribute('data-done')
          ) {
            candidate.setAttribute('data-done', '1');
            const detail = candidate.getAttribute('data-detail') || '';
            candidate.textContent =
              (isError ? '✗ ' : '✓ ') +
              label +
              (detail ? ' (' + detail + ')' : '') +
              ' — ' +
              (isError ? STRINGS.toolFailed : STRINGS.toolDone);
            if (isError) {
              candidate.className += ' error';
            }
            break;
          }
        }
        setBusyLabel(STRINGS.working);
      }
      scrollDown();
    },
    turnComplete(isError, errorMessage) {
      closeStream();
      closeThinkingBox();
      if (isError) {
        bubble('system error').textContent =
          STRINGS.turnError + (errorMessage ? ': ' + errorMessage : '');
      }
      api.setBusy(false);
    },
    setStatus(text, kind) {
      statusText.textContent = text;
      statusDot.className =
        'mc-status-dot ' +
        (kind === 'ok' ? 'ok' : kind === 'busy' ? 'busy' : 'bad');
    },
    setBusy(value) {
      busy = value;
      busyBar.style.display = value ? '' : 'none';
      sendBtn.disabled = value;
      if (value) {
        busyStart = new Date().getTime();
        setBusyLabel(STRINGS.working);
        busyElapsed.textContent = '';
        if (busyTimer === null) {
          busyTimer = window.setInterval(updateElapsed, 1000);
        }
      } else {
        if (busyTimer !== null) {
          window.clearInterval(busyTimer);
          busyTimer = null;
        }
        input.focus();
      }
    },
    showFatal(message) {
      const overlay = el('div', 'mc-fatal', root);
      overlay.textContent = message;
    },
    addSystemNote(text) {
      bubble('system').textContent = text;
    },
  };

  api.addSystemNote(STRINGS.welcome);
  return api;
}
