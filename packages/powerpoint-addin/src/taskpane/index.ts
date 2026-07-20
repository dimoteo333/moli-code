/** PowerPoint task-pane bootstrap and WebSocket/UI wiring. */

import {
  PROTOCOL_VERSION,
  type SidecarToPaneFrame,
} from '../shared/messages.js';
import { createWsClient, type WsClient } from './ws-client.js';
import { createChatUi, type ChatUi } from './chat-ui.js';
import { createPermissionQueue } from './permission-ui.js';
import { createQuestionQueue } from './question-ui.js';
import { STRINGS } from './strings.ko.js';

const POWERPOINT_API_VERSIONS = ['1.1', '1.2', '1.3', '1.4'];

function isMockMode(): boolean {
  return window.location.search.indexOf('mock=1') >= 0;
}

function detectRequirementSets(): { [set: string]: boolean } {
  const sets: { [set: string]: boolean } = {};
  for (let i = 0; i < POWERPOINT_API_VERSIONS.length; i++) {
    const version = POWERPOINT_API_VERSIONS[i];
    let supported = false;
    try {
      supported = Office.context.requirements.isSetSupported(
        'PowerPointApi',
        version,
      );
    } catch (_e) {
      supported = false;
    }
    sets['PowerPointApi ' + version] = supported;
  }
  return sets;
}

function start(
  requirementSets: { [set: string]: boolean },
  platform: string,
): void {
  const root = document.getElementById('app');
  if (!root) return;
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
    onSend(text, attachments) {
      if (client) {
        client.send({
          v: PROTOCOL_VERSION,
          type: 'user_message',
          text,
          attachments,
        });
      }
    },
    onStop() {
      if (client) client.send({ v: PROTOCOL_VERSION, type: 'interrupt' });
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
  const questions = createQuestionQueue((id, decision) => {
    if (client) {
      client.send({
        v: PROTOCOL_VERSION,
        type: 'question_response',
        id,
        behavior: decision.behavior,
        answers: decision.answers,
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
        if (text) chat.finalizeAssistantMessage(frame.turnId, text);
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
      case 'question_request':
        questions.enqueue({ id: frame.id, questions: frame.questions });
        break;
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
        host: 'PowerPoint',
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
    start({ 'PowerPointApi 1.1': true }, 'mock');
    return;
  }
  if (typeof Office !== 'undefined' && Office.onReady) {
    Office.onReady((info) => {
      start(detectRequirementSets(), String(info.platform || ''));
    });
  } else if (typeof Office !== 'undefined') {
    Office.initialize = function () {
      start(detectRequirementSets(), 'legacy');
    };
  } else {
    start({}, 'no-office');
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
