import { describe, expect, it, vi } from 'vitest';
import {
  buildExcelMcpServer,
  excelSetFormulasDescription,
  excelSetFormulasInput,
  excelToolBaseName,
  gatedExec,
  isReadOnlyExcelTool,
} from '../src/sidecar/excel-mcp.js';
import { RpcManager } from '../src/sidecar/rpc.js';
import { PROTOCOL_VERSION } from '../src/shared/messages.js';

describe('excelToolBaseName', () => {
  it('strips MCP prefixes', () => {
    expect(excelToolBaseName('mcp__excel__excel_read_range')).toBe(
      'excel_read_range',
    );
    expect(excelToolBaseName('excel_read_range')).toBe('excel_read_range');
  });
});

describe('isReadOnlyExcelTool', () => {
  it('classifies read vs write tools', () => {
    expect(isReadOnlyExcelTool('excel_read_range')).toBe(true);
    expect(isReadOnlyExcelTool('excel_get_selection')).toBe(true);
    expect(isReadOnlyExcelTool('excel_write_range')).toBe(false);
    expect(isReadOnlyExcelTool('excel_clear_range')).toBe(false);
  });
});

describe('buildExcelMcpServer', () => {
  it('creates an sdk server config with the excel tool set', () => {
    const rpc = new RpcManager(() => {});
    const server = buildExcelMcpServer(rpc, async () => ({ allowed: true }), {
      'ExcelApi 1.1': true,
    });
    expect(server.type).toBe('sdk');
    expect(server.name).toBe('excel');
    expect(server.instance).toBeDefined();
  });
});

describe('excel_set_formulas contract', () => {
  it('advertises and validates optional fillDown without changing legacy calls', () => {
    expect(excelSetFormulasDescription).toContain('fillDown');
    expect(excelSetFormulasInput.fillDown.safeParse(true).success).toBe(true);
    expect(excelSetFormulasInput.fillDown.safeParse(undefined).success).toBe(
      true,
    );
    expect(excelSetFormulasInput.fillDown.safeParse('true').success).toBe(
      false,
    );
  });
});

describe('gatedExec', () => {
  it('skips the gate for read-only tools', async () => {
    const rpc = new RpcManager((frame) => {
      rpc.handleResult({
        v: PROTOCOL_VERSION,
        type: 'excel_result',
        id: frame.id,
        ok: true,
        result: { address: 'A1' },
      });
    });
    const gate = vi.fn();
    const result = await gatedExec(
      rpc,
      gate,
      'excel_read_range',
      'read_range',
      { range: 'A1' },
    );
    expect(gate).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('A1');
  });

  it('asks the gate for write tools and executes on allow', async () => {
    const rpc = new RpcManager((frame) => {
      rpc.handleResult({
        v: PROTOCOL_VERSION,
        type: 'excel_result',
        id: frame.id,
        ok: true,
        result: { written: 'A1' },
      });
    });
    const gate = vi.fn().mockResolvedValue({ allowed: true });
    const result = await gatedExec(
      rpc,
      gate,
      'excel_write_range',
      'write_range',
      {
        range: 'A1',
        values: [[1]],
      },
    );
    expect(gate).toHaveBeenCalledWith('excel_write_range', {
      range: 'A1',
      values: [[1]],
    });
    expect(result.isError).toBeUndefined();
  });

  it('does not execute when the gate denies', async () => {
    const sent: unknown[] = [];
    const rpc = new RpcManager((frame) => sent.push(frame));
    const gate = vi
      .fn()
      .mockResolvedValue({ allowed: false, message: '거부됨' });
    const result = await gatedExec(
      rpc,
      gate,
      'excel_clear_range',
      'clear_range',
      { range: 'A1' },
    );
    expect(sent).toHaveLength(0);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('거부됨');
  });
});
