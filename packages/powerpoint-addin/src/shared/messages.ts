/**
 * WebSocket wire protocol between the PowerPoint task pane and the local
 * sidecar. This module is bundled for both Node and the IE11-compatible pane.
 */

export const PROTOCOL_VERSION = 1;
export const WS_PATH = '/ws';

/** A user-selected local file. Browsers intentionally do not expose its path. */
export interface LocalFileAttachment {
  name: string;
  content: string;
  size: number;
  mimeType?: string;
  /** Omitted means UTF-8, preserving the version 1 text attachment contract. */
  encoding?: 'utf8' | 'base64';
}

// Pane → Sidecar
export interface HelloFrame {
  v: number;
  type: 'hello';
  token: string;
  requirementSets: { [set: string]: boolean };
  host?: string;
  platform?: string;
  uiLocale?: string;
}

export interface UserMessageFrame {
  v: number;
  type: 'user_message';
  text: string;
  attachments?: LocalFileAttachment[];
}

export interface PermissionResponseFrame {
  v: number;
  type: 'permission_response';
  id: string;
  behavior: 'allow' | 'deny';
  alwaysAllow?: boolean;
  message?: string;
}

export interface QuestionResponseFrame {
  v: number;
  type: 'question_response';
  id: string;
  behavior: 'answer' | 'cancel';
  answers?: { [index: string]: string };
}

export interface InterruptFrame {
  v: number;
  type: 'interrupt';
}

export interface PingFrame {
  v: number;
  type: 'ping';
}

export type PaneToSidecarFrame =
  | HelloFrame
  | UserMessageFrame
  | PermissionResponseFrame
  | QuestionResponseFrame
  | InterruptFrame
  | PingFrame;

// Sidecar → Pane
export interface HelloOkFrame {
  v: number;
  type: 'hello_ok';
  sessionId: string;
  version: string;
  model?: string;
}

export interface HelloErrFrame {
  v: number;
  type: 'hello_err';
  reason: string;
}

export interface AssistantDeltaFrame {
  v: number;
  type: 'assistant_delta';
  turnId: number;
  text: string;
}

export interface PaneContentBlock {
  type: string;
  text?: string;
}

export interface AssistantMessageFrame {
  v: number;
  type: 'assistant_message';
  turnId: number;
  blocks: PaneContentBlock[];
}

export interface ThinkingFrame {
  v: number;
  type: 'thinking';
  turnId: number;
  text: string;
}

export interface ToolActivityFrame {
  v: number;
  type: 'tool_activity';
  turnId: number;
  toolName: string;
  status: 'start' | 'end';
  isError?: boolean;
  summary?: string;
}

export interface PermissionRequestFrame {
  v: number;
  type: 'permission_request';
  id: string;
  toolName: string;
  inputPreview: string;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionSpec {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export interface QuestionRequestFrame {
  v: number;
  type: 'question_request';
  id: string;
  questions: QuestionSpec[];
}

export interface TurnCompleteFrame {
  v: number;
  type: 'turn_complete';
  turnId: number;
  isError?: boolean;
  errorMessage?: string;
}

export interface ErrorFrame {
  v: number;
  type: 'error';
  code: string;
  messageKo: string;
}

export interface PongFrame {
  v: number;
  type: 'pong';
}

export type PerformanceEventName =
  | 'query_spawn_started'
  | 'cli_initialized'
  | 'query_prewarm_failed'
  | 'user_message_enqueued'
  | 'first_delta_received'
  | 'artifact_saved';

export interface PerformanceEventFrame {
  v: number;
  type: 'performance_event';
  name: PerformanceEventName;
  elapsedMs: number;
  turnId?: number;
  detail?: string;
}

export type SidecarToPaneFrame =
  | HelloOkFrame
  | HelloErrFrame
  | AssistantDeltaFrame
  | AssistantMessageFrame
  | ThinkingFrame
  | ToolActivityFrame
  | PermissionRequestFrame
  | QuestionRequestFrame
  | TurnCompleteFrame
  | ErrorFrame
  | PerformanceEventFrame
  | PongFrame;

export type AnyFrame = PaneToSidecarFrame | SidecarToPaneFrame;

export function parseFrame(raw: string): AnyFrame | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch (_e) {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) {
    return null;
  }
  const frame = obj as { v?: unknown; type?: unknown };
  if (frame.v !== PROTOCOL_VERSION || typeof frame.type !== 'string') {
    return null;
  }
  return obj as AnyFrame;
}

export function serializeFrame(frame: AnyFrame): string {
  return JSON.stringify(frame);
}
