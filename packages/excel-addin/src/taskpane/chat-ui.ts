/**
 * Plain-DOM chat UI (ES5, IE11-safe): user bubbles, streamed assistant
 * markdown-lite text, tool-activity chips, status bar, input row.
 */

import { STRINGS, toolLabel } from './strings.ko.js';

export interface ChatUiCallbacks {
  onSend: (text: string) => void;
  onStop: () => void;
}

export interface ChatUi {
  addUserMessage(text: string): void;
  appendAssistantDelta(turnId: number, text: string): void;
  finalizeAssistantMessage(turnId: number, fullText: string): void;
  addToolChip(
    turnId: number,
    toolName: string,
    status: 'start' | 'end',
    isError?: boolean,
  ): void;
  turnComplete(isError?: boolean, errorMessage?: string): void;
  setStatus(text: string, kind: 'ok' | 'busy' | 'bad'): void;
  setBusy(busy: boolean): void;
  showFatal(message: string): void;
  addSystemNote(text: string): void;
}

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (parent) {
    parent.appendChild(node);
  }
  return node;
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
  const stopBtn = el('button', 'mc-stop-btn', busyBar) as HTMLButtonElement;
  stopBtn.textContent = STRINGS.stop;
  stopBtn.onclick = function () {
    callbacks.onStop();
  };
  busyBar.style.display = 'none';

  const inputRow = el('div', 'mc-input-row', root);
  const input = el('textarea', 'mc-input', inputRow) as HTMLTextAreaElement;
  input.setAttribute('placeholder', STRINGS.inputPlaceholder);
  input.setAttribute('rows', '2');
  const sendBtn = el('button', 'mc-send-btn', inputRow) as HTMLButtonElement;
  sendBtn.textContent = STRINGS.send;

  let busy = false;
  // One streaming bubble per turn.
  let streamTurnId = -1;
  let streamNode: HTMLElement | null = null;

  function scrollDown(): void {
    messages.scrollTop = messages.scrollHeight;
  }

  function submit(): void {
    const text = input.value.replace(/^\s+|\s+$/g, '');
    if (!text || busy) {
      return;
    }
    input.value = '';
    callbacks.onSend(text);
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
    return streamNode;
  }

  const api: ChatUi = {
    addUserMessage(text) {
      bubble('user').textContent = text;
    },
    appendAssistantDelta(turnId, text) {
      const node = getStreamNode(turnId);
      node.textContent = (node.textContent || '') + text;
      scrollDown();
    },
    finalizeAssistantMessage(turnId, fullText) {
      const node = getStreamNode(turnId);
      node.textContent = fullText;
      // Next assistant output in the same turn opens a fresh bubble
      // (tool calls interleave between text blocks).
      streamNode = null;
      streamTurnId = -1;
      scrollDown();
    },
    addToolChip(turnId, toolName, status, isError) {
      streamNode = null;
      streamTurnId = -1;
      if (status === 'start') {
        const chip = bubble('tool');
        chip.setAttribute('data-tool', toolName);
        chip.textContent =
          '⚙ ' + toolLabel(toolName) + ' — ' + STRINGS.toolRunning;
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
            candidate.textContent =
              (isError ? '✗ ' : '✓ ') +
              toolLabel(toolName) +
              ' — ' +
              (isError ? STRINGS.toolFailed : STRINGS.toolDone);
            if (isError) {
              candidate.className += ' error';
            }
            break;
          }
        }
      }
      scrollDown();
    },
    turnComplete(isError, errorMessage) {
      streamNode = null;
      streamTurnId = -1;
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
      if (!value) {
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
