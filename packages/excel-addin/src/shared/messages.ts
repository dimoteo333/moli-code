/**
 * WebSocket wire protocol between the Excel task pane and the local sidecar.
 *
 * Every frame is a single JSON object: `{ v: 1, type: '...', ... }`.
 * This file is bundled into BOTH the sidecar (Node) and the task pane
 * (ES5 / IE11) — keep it free of runtime dependencies and ES2015+ APIs.
 */

export const PROTOCOL_VERSION = 1;

export const WS_PATH = '/ws';

/** Ops the sidecar can ask the pane to execute against the workbook. */
export type ExcelOp =
  | 'get_workbook_overview'
  | 'read_range'
  | 'write_range'
  | 'set_formulas'
  | 'get_selection'
  | 'clear_range'
  | 'add_worksheet'
  | 'format_range'
  | 'find';

// ---------------------------------------------------------------------------
// Pane → Sidecar
// ---------------------------------------------------------------------------

export interface HelloFrame {
  v: number;
  type: 'hello';
  token: string;
  /** e.g. { 'ExcelApi 1.1': true, 'ExcelApi 1.4': false } */
  requirementSets: { [set: string]: boolean };
  host?: string;
  platform?: string;
  uiLocale?: string;
}

export interface UserMessageFrame {
  v: number;
  type: 'user_message';
  text: string;
}

export interface PermissionResponseFrame {
  v: number;
  type: 'permission_response';
  id: string;
  behavior: 'allow' | 'deny';
  /** Auto-approve this tool for the rest of the session. */
  alwaysAllow?: boolean;
  message?: string;
}

export interface ExcelResultFrame {
  v: number;
  type: 'excel_result';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  errorCode?: string;
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
  | ExcelResultFrame
  | InterruptFrame
  | PingFrame;

// ---------------------------------------------------------------------------
// Sidecar → Pane
// ---------------------------------------------------------------------------

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

/** Simplified content block for the pane (text only; tools go via tool_activity). */
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

/**
 * Streamed extended-thinking text. The pane shows a live "thinking" hint
 * while the model reasons before producing visible output.
 */
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
  /** Compact JSON preview of the tool input for display. */
  inputPreview: string;
}

export interface ExcelExecFrame {
  v: number;
  type: 'excel_exec';
  id: string;
  op: ExcelOp;
  args: { [key: string]: unknown };
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
  | ExcelExecFrame
  | TurnCompleteFrame
  | ErrorFrame
  | PerformanceEventFrame
  | PongFrame;

export type AnyFrame = PaneToSidecarFrame | SidecarToPaneFrame;

// ---------------------------------------------------------------------------
// Helpers (ES5-safe)
// ---------------------------------------------------------------------------

/** Parse a raw WS payload into a frame, or return null if malformed. */
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
