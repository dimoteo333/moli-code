/**
 * Task pane bootstrap. Waits for Office.js (or runs with the mock workbook
 * when the URL has ?mock=1), fetches the WS token and wires everything up.
 */

import {
  PROTOCOL_VERSION,
  type SidecarToPaneFrame,
} from '../shared/messages.js';
import {
  EXCEL_API_VERSIONS,
  supportsNativeFillDown,
} from '../shared/excel-capabilities.js';
import { createWsClient, type WsClient } from './ws-client.js';
import {
  createChatUi,
  type ChatUi,
  type SelectionAttachment,
} from './chat-ui.js';
import { createPermissionQueue } from './permission-ui.js';
import { createOfficeExecutor, type ExcelExecutor } from './excel-executor.js';
import { createMockExecutor } from './mock-executor.js';
import { STRINGS } from './strings.ko.js';

function isMockMode(): boolean {
  return window.location.search.indexOf('mock=1') >= 0;
}

function detectRequirementSets(): { [set: string]: boolean } {
  const sets: { [set: string]: boolean } = {};
  for (let i = 0; i < EXCEL_API_VERSIONS.length; i++) {
    const version = EXCEL_API_VERSIONS[i];
    let supported = false;
    try {
      supported = Office.context.requirements.isSetSupported(
        'ExcelApi',
        version,
      );
    } catch (_e) {
      supported = false;
    }
    sets['ExcelApi ' + version] = supported;
  }
  return sets;
}

function start(
  executor: ExcelExecutor,
  requirementSets: { [set: string]: boolean },
  platform: string,
): void {
  const root = document.getElementById('app');
  if (!root) {
    return;
  }

  if (typeof WebSocket === 'undefined') {
    root.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'mc-fatal';
    msg.textContent = STRINGS.errNoWebSocket;
    root.appendChild(msg);
    return;
  }

  let client: WsClient | null = null;

  const chat: ChatUi = createChatUi(root, {
    onSend(text) {
      if (client) {
        client.send({ v: PROTOCOL_VERSION, type: 'user_message', text });
      }
    },
    onStop() {
      if (client) {
        client.send({ v: PROTOCOL_VERSION, type: 'interrupt' });
      }
    },
    onGetSelection() {
      return executor
        .exec('get_selection', {})
        .then((result) => result as SelectionAttachment);
    },
  });

  const permissions = createPermissionQueue((id, decision) => {
    if (client) {
      client.send({
        v: PROTOCOL_VERSION,
        type: 'permission_response',
        id,
        behavior: decision.behavior,
        alwaysAllow: decision.alwaysAllow,
        message: decision.message,
      });
    }
  });

  function handleFrame(frame: SidecarToPaneFrame): void {
    switch (frame.type) {
      case 'hello_ok':
        chat.setStatus(STRINGS.statusConnected, 'ok');
        break;
      case 'hello_err':
        chat.setStatus(STRINGS.errHello, 'bad');
        break;
      case 'assistant_delta':
        chat.appendAssistantDelta(frame.turnId, frame.text);
        break;
      case 'assistant_message': {
        let text = '';
        for (let i = 0; i < frame.blocks.length; i++) {
          if (frame.blocks[i].type === 'text' && frame.blocks[i].text) {
            text += (text ? '\n' : '') + frame.blocks[i].text;
          }
        }
        if (text) {
          chat.finalizeAssistantMessage(frame.turnId, text);
        }
        break;
      }
      case 'thinking':
        chat.showThinking(frame.turnId, frame.text);
        break;
      case 'tool_activity':
        chat.addToolChip(
          frame.turnId,
          frame.toolName,
          frame.status,
          frame.isError,
          frame.summary,
        );
        break;
      case 'permission_request':
        permissions.enqueue({
          id: frame.id,
          toolName: frame.toolName,
          inputPreview: frame.inputPreview,
        });
        break;
      case 'excel_exec': {
        const execId = frame.id;
        executor.exec(frame.op, frame.args).then(
          (result) => {
            if (client) {
              client.send({
                v: PROTOCOL_VERSION,
                type: 'excel_result',
                id: execId,
                ok: true,
                result,
              });
            }
          },
          (err) => {
            const oErr = err as {
              message?: string;
              code?: string;
              debugInfo?: unknown;
            };
            if (client) {
              client.send({
                v: PROTOCOL_VERSION,
                type: 'excel_result',
                id: execId,
                ok: false,
                error: oErr && oErr.message ? oErr.message : String(err),
                errorCode: oErr && oErr.code ? oErr.code : undefined,
              });
            }
          },
        );
        break;
      }
      case 'turn_complete':
        chat.turnComplete(frame.isError, frame.errorMessage);
        break;
      case 'error':
        chat.addSystemNote(frame.messageKo);
        chat.setBusy(false);
        break;
      case 'pong':
        break;
      default:
        break;
    }
  }

  client = createWsClient({
    buildHello(token) {
      return {
        v: PROTOCOL_VERSION,
        type: 'hello',
        token,
        requirementSets,
        host: 'Excel',
        platform,
        uiLocale: 'ko-KR',
      };
    },
    onFrame: handleFrame,
    onStatus(status) {
      if (status === 'connected') {
        chat.setStatus(STRINGS.statusConnected, 'ok');
      } else if (status === 'connecting') {
        chat.setStatus(STRINGS.statusConnecting, 'busy');
      } else {
        chat.setStatus(STRINGS.statusDisconnected, 'bad');
        chat.setBusy(false);
      }
    },
  });
}

function boot(): void {
  if (isMockMode()) {
    start(
      createMockExecutor(),
      { 'ExcelApi 1.1': true, 'ExcelApi 1.9': true },
      'mock',
    );
    return;
  }
  if (typeof Office !== 'undefined' && Office.onReady) {
    Office.onReady((info) => {
      const requirementSets = detectRequirementSets();
      start(
        createOfficeExecutor({
          supportsFillDown: supportsNativeFillDown(requirementSets),
        }),
        requirementSets,
        String(info.platform || ''),
      );
    });
  } else if (typeof Office !== 'undefined') {
    // Very old office.js: fall back to Office.initialize.
    Office.initialize = function () {
      const requirementSets = detectRequirementSets();
      start(
        createOfficeExecutor({
          supportsFillDown: supportsNativeFillDown(requirementSets),
        }),
        requirementSets,
        'legacy',
      );
    };
  } else {
    // office.js failed to load — run detached so the failure is visible.
    start(createMockExecutor(), {}, 'no-office');
  }
}

if (document.readyState === 'loading') {
  document.onreadystatechange = function () {
    if (
      document.readyState === 'interactive' ||
      document.readyState === 'complete'
    ) {
      document.onreadystatechange = null;
      boot();
    }
  };
} else {
  boot();
}
