/**
 * Request/response correlation for sidecar → pane `excel_exec` calls.
 *
 * The MCP Excel tool handlers call `RpcManager.call()`; the pane answers with
 * an `excel_result` frame which `handleResult()` matches back to the pending
 * promise. All pending calls are rejected when the pane disconnects.
 */

import type {
  ExcelOp,
  ExcelExecFrame,
  ExcelResultFrame,
} from '../shared/messages.js';
import { PROTOCOL_VERSION } from '../shared/messages.js';

export class RpcError extends Error {
  readonly code: string;

  constructor(message: string, code = 'RPC_ERROR') {
    super(message);
    this.name = 'RpcError';
    this.code = code;
  }
}

interface PendingCall {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export const DEFAULT_RPC_TIMEOUT_MS = 90_000;

export class RpcManager {
  private readonly pending = new Map<string, PendingCall>();
  private seq = 0;

  constructor(
    private readonly sendFrame: (frame: ExcelExecFrame) => void,
    private readonly defaultTimeoutMs: number = DEFAULT_RPC_TIMEOUT_MS,
  ) {}

  get pendingCount(): number {
    return this.pending.size;
  }

  call(
    op: ExcelOp,
    args: Record<string, unknown>,
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<unknown> {
    const id = `rpc-${++this.seq}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new RpcError(
            `Excel operation '${op}' timed out after ${timeoutMs}ms`,
            'RPC_TIMEOUT',
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.sendFrame({
          v: PROTOCOL_VERSION,
          type: 'excel_exec',
          id,
          op,
          args,
        });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new RpcError(String(err)));
      }
    });
  }

  /** Returns true if the frame matched a pending call. */
  handleResult(frame: ExcelResultFrame): boolean {
    const entry = this.pending.get(frame.id);
    if (!entry) {
      return false;
    }
    this.pending.delete(frame.id);
    clearTimeout(entry.timer);
    if (frame.ok) {
      entry.resolve(frame.result);
    } else {
      entry.reject(
        new RpcError(
          frame.error ?? 'unknown Excel error',
          frame.errorCode ?? 'EXCEL_ERROR',
        ),
      );
    }
    return true;
  }

  rejectAll(reason: string): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new RpcError(reason, 'RPC_DISCONNECTED'));
    }
    this.pending.clear();
  }
}
