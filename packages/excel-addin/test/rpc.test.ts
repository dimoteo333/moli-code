import { describe, expect, it, vi } from 'vitest';
import { RpcManager, RpcError } from '../src/sidecar/rpc.js';
import {
  PROTOCOL_VERSION,
  type ExcelExecFrame,
} from '../src/shared/messages.js';

describe('RpcManager', () => {
  it('resolves a call when a matching excel_result arrives', async () => {
    const sent: ExcelExecFrame[] = [];
    const rpc = new RpcManager((f) => sent.push(f));

    const promise = rpc.call('read_range', { range: 'A1:B2' });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('excel_exec');
    expect(sent[0].op).toBe('read_range');

    const matched = rpc.handleResult({
      v: PROTOCOL_VERSION,
      type: 'excel_result',
      id: sent[0].id,
      ok: true,
      result: { values: [[1, 2]] },
    });
    expect(matched).toBe(true);
    await expect(promise).resolves.toEqual({ values: [[1, 2]] });
    expect(rpc.pendingCount).toBe(0);
  });

  it('rejects a call on error result with the pane error message', async () => {
    const sent: ExcelExecFrame[] = [];
    const rpc = new RpcManager((f) => sent.push(f));
    const promise = rpc.call('write_range', { range: 'A1', values: [[1]] });

    rpc.handleResult({
      v: PROTOCOL_VERSION,
      type: 'excel_result',
      id: sent[0].id,
      ok: false,
      error: 'InvalidArgument: range',
      errorCode: 'InvalidArgument',
    });
    await expect(promise).rejects.toMatchObject({
      message: 'InvalidArgument: range',
      code: 'InvalidArgument',
    });
  });

  it('ignores results for unknown ids', () => {
    const rpc = new RpcManager(() => {});
    expect(
      rpc.handleResult({
        v: PROTOCOL_VERSION,
        type: 'excel_result',
        id: 'rpc-999',
        ok: true,
      }),
    ).toBe(false);
  });

  it('times out slow calls', async () => {
    vi.useFakeTimers();
    try {
      const rpc = new RpcManager(() => {});
      const promise = rpc.call('get_selection', {}, 1_000);
      // Fire the timeout before awaiting, so the assertion can settle.
      vi.advanceTimersByTime(1_001);
      await expect(promise).rejects.toMatchObject({
        code: 'RPC_TIMEOUT',
      });
      expect(rpc.pendingCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects all pending calls on disconnect', async () => {
    const rpc = new RpcManager(() => {});
    const a = rpc.call('get_selection', {});
    const b = rpc.call('read_range', { range: 'A1' });
    rpc.rejectAll('pane disconnected');
    await expect(a).rejects.toBeInstanceOf(RpcError);
    await expect(b).rejects.toMatchObject({ code: 'RPC_DISCONNECTED' });
  });

  it('rejects immediately when sending fails', async () => {
    const rpc = new RpcManager(() => {
      throw new Error('socket closed');
    });
    await expect(rpc.call('get_selection', {})).rejects.toThrow(
      'socket closed',
    );
    expect(rpc.pendingCount).toBe(0);
  });
});
