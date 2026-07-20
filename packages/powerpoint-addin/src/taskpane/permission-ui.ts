/**
 * Permission modal: shows the tool the agent wants to run and its input,
 * with [허용] / [이 세션에서 항상 허용] / [거부].
 *
 * Requests are queued and shown one at a time. When the user picks
 * "항상 허용", the tool is remembered for the session and every queued or
 * future request for the same tool is answered automatically — no more
 * repeated pop-ups.
 */

import { STRINGS, toolLabel } from './strings.ko.js';

export interface PermissionDecision {
  behavior: 'allow' | 'deny';
  alwaysAllow?: boolean;
  message?: string;
}

export interface PermissionRequest {
  id: string;
  toolName: string;
  inputPreview: string;
}

export interface PermissionQueue {
  enqueue(request: PermissionRequest): void;
}

/** Bare tool name without an MCP prefix. */
function baseToolName(toolName: string): string {
  const idx = toolName.lastIndexOf('__');
  return idx >= 0 ? toolName.slice(idx + 2) : toolName;
}

/**
 * One-at-a-time permission dialog queue with per-session always-allow
 * memory. `respond` delivers the user's decision for a request id.
 */
export function createPermissionQueue(
  respond: (id: string, decision: PermissionDecision) => void,
): PermissionQueue {
  const queue: PermissionRequest[] = [];
  const alwaysAllowed: { [base: string]: boolean } = {};
  let showing = false;

  function pump(): void {
    if (showing) {
      return;
    }
    while (queue.length > 0) {
      const request = queue.shift() as PermissionRequest;
      if (alwaysAllowed[baseToolName(request.toolName)]) {
        respond(request.id, { behavior: 'allow', alwaysAllow: true });
        continue;
      }
      showing = true;
      showPermissionDialog(
        request.toolName,
        request.inputPreview,
        (decision) => {
          if (decision.behavior === 'allow' && decision.alwaysAllow) {
            alwaysAllowed[baseToolName(request.toolName)] = true;
          }
          respond(request.id, decision);
          showing = false;
          pump();
        },
      );
      return;
    }
  }

  return {
    enqueue(request: PermissionRequest): void {
      if (alwaysAllowed[baseToolName(request.toolName)]) {
        respond(request.id, { behavior: 'allow', alwaysAllow: true });
        return;
      }
      queue.push(request);
      pump();
    },
  };
}

export function showPermissionDialog(
  toolName: string,
  inputPreview: string,
  onDecision: (decision: PermissionDecision) => void,
): void {
  const overlay = document.createElement('div');
  overlay.className = 'mc-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'mc-modal';
  overlay.appendChild(modal);

  const title = document.createElement('div');
  title.className = 'mc-modal-title';
  title.textContent = STRINGS.permissionTitle;
  modal.appendChild(title);

  const body = document.createElement('div');
  body.className = 'mc-modal-body';
  body.textContent = STRINGS.permissionBody;
  modal.appendChild(body);

  const tool = document.createElement('div');
  tool.className = 'mc-modal-tool';
  tool.textContent = toolLabel(toolName);
  modal.appendChild(tool);

  let pretty = inputPreview;
  try {
    pretty = JSON.stringify(JSON.parse(inputPreview), null, 2);
  } catch (_e) {
    // keep as-is
  }
  const detail = document.createElement('pre');
  detail.className = 'mc-modal-detail';
  detail.textContent = pretty;
  modal.appendChild(detail);

  const buttons = document.createElement('div');
  buttons.className = 'mc-modal-buttons';
  modal.appendChild(buttons);

  let settled = false;
  function decide(decision: PermissionDecision): void {
    if (settled) {
      return;
    }
    settled = true;
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    onDecision(decision);
  }

  function makeButton(
    label: string,
    className: string,
    decision: PermissionDecision,
  ): void {
    const btn = document.createElement('button');
    btn.className = 'mc-modal-btn ' + className;
    btn.textContent = label;
    btn.onclick = function () {
      decide(decision);
    };
    buttons.appendChild(btn);
  }

  makeButton(STRINGS.allow, 'primary', { behavior: 'allow' });
  makeButton(STRINGS.alwaysAllow, 'secondary', {
    behavior: 'allow',
    alwaysAllow: true,
  });
  makeButton(STRINGS.deny, 'danger', {
    behavior: 'deny',
    message: STRINGS.denyMessage,
  });

  document.body.appendChild(overlay);
}
