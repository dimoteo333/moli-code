/**
 * SDK-embedded MCP server exposing the workbook to the agent.
 *
 * Each tool handler forwards the call over the pane WebSocket (RpcManager →
 * excel_exec frame); the pane executes it via Office.js `Excel.run()` and
 * answers with excel_result. All v1 tools only require ExcelApi 1.1
 * (Excel 2016 baseline).
 */

import { z } from 'zod';
import {
  tool,
  createSdkMcpServer,
  type McpSdkServerConfigWithInstance,
} from '@dobby/moli-code-sdk';
import type { ExcelOp } from '../shared/messages.js';
import type { RpcManager } from './rpc.js';

/** Tools that never modify the workbook — auto-approved without prompting. */
const READ_ONLY_TOOLS = new Set([
  'excel_get_workbook_overview',
  'excel_read_range',
  'excel_get_selection',
  'excel_find',
]);

export function isReadOnlyExcelTool(baseName: string): boolean {
  return READ_ONLY_TOOLS.has(baseName);
}

/**
 * canUseTool may see MCP tools under a prefixed name (e.g.
 * "mcp__excel__excel_read_range"); reduce to the bare tool name.
 */
export function excelToolBaseName(toolName: string): string {
  const idx = toolName.lastIndexOf('__');
  return idx >= 0 ? toolName.slice(idx + 2) : toolName;
}

interface TextToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Asks the user (via the pane modal) whether a workbook-modifying tool may
 * run. The CLI auto-trusts SDK-embedded MCP servers, so this gate — not the
 * CLI's permission flow — is what protects writes.
 */
export type PermissionGate = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<{ allowed: boolean; message?: string }>;

function ok(result: unknown): TextToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(result ?? { ok: true }) }],
  };
}

function fail(op: ExcelOp, err: unknown): TextToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [
      { type: 'text', text: `Excel operation '${op}' failed: ${message}` },
    ],
    isError: true,
  };
}

export async function gatedExec(
  rpc: RpcManager,
  gate: PermissionGate,
  toolName: string,
  op: ExcelOp,
  args: Record<string, unknown>,
): Promise<TextToolResult> {
  if (!isReadOnlyExcelTool(toolName)) {
    const decision = await gate(toolName, args);
    if (!decision.allowed) {
      return {
        content: [
          {
            type: 'text',
            text: `Permission denied by the user: ${decision.message ?? 'the user rejected this operation'}`,
          },
        ],
        isError: true,
      };
    }
  }
  try {
    return ok(await rpc.call(op, args));
  } catch (err) {
    return fail(op, err);
  }
}

const sheetParam = z
  .string()
  .optional()
  .describe('Worksheet name. Omit to use the active worksheet.');

const rangeParam = z
  .string()
  .describe("Range in A1 notation, e.g. 'A1:C10' or 'B2'.");

const cellValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const excelSetFormulasDescription =
  "Set formulas in a range. The 2D array dimensions must match the range. Formulas start with '=', e.g. '=SUM(A1:A10)'. Non-formula strings are written as literal values. To fill a repeated multi-row range efficiently, set fillDown=true and provide exactly one formula row matching the target column count; Excel writes the first row and fills it down natively.";

export const excelSetFormulasInput = {
  sheet: sheetParam,
  range: rangeParam,
  formulas: z
    .array(z.array(z.string()))
    .describe(
      '2D array of formula strings; exactly one row when fillDown=true.',
    ),
  fillDown: z
    .boolean()
    .optional()
    .describe(
      'Fill the first formula row down an explicit multi-row target range.',
    ),
};

export function buildExcelMcpServer(
  rpc: RpcManager,
  gate: PermissionGate,
  requirementSets: { [set: string]: boolean },
): McpSdkServerConfigWithInstance {
  const capabilityNote = requirementSets['ExcelApi 1.4']
    ? ''
    : ' The host is Excel 2016-era: only basic (ExcelApi 1.1) features are available.';

  return createSdkMcpServer({
    name: 'excel',
    version: '1.0.0',
    tools: [
      tool(
        'excel_get_workbook_overview',
        `Get an overview of the open workbook: worksheet names, used range address and dimensions per sheet, the active sheet, and the current selection. Call this first to orient yourself.${capabilityNote}`,
        {},
        async () =>
          gatedExec(
            rpc,
            gate,
            'excel_get_workbook_overview',
            'get_workbook_overview',
            {},
          ),
      ),
      tool(
        'excel_read_range',
        'Read cell values, formulas and number formats from a range. Large ranges are truncated (about 10,000 cells); read in chunks if needed.',
        { sheet: sheetParam, range: rangeParam },
        async (args) =>
          gatedExec(rpc, gate, 'excel_read_range', 'read_range', args),
      ),
      tool(
        'excel_write_range',
        'Write a 2D array of values into a range. The array dimensions must match the range dimensions. Overwrites existing cell contents.',
        {
          sheet: sheetParam,
          range: rangeParam,
          values: z
            .array(z.array(cellValue))
            .describe('2D array of rows; each row is an array of cell values.'),
        },
        async (args) =>
          gatedExec(rpc, gate, 'excel_write_range', 'write_range', args),
      ),
      tool(
        'excel_set_formulas',
        excelSetFormulasDescription,
        excelSetFormulasInput,
        async (args) =>
          gatedExec(rpc, gate, 'excel_set_formulas', 'set_formulas', args),
      ),
      tool(
        'excel_get_selection',
        'Get the currently selected range: address, values and formulas.',
        {},
        async () =>
          gatedExec(rpc, gate, 'excel_get_selection', 'get_selection', {}),
      ),
      tool(
        'excel_clear_range',
        'Clear a range: contents (values/formulas), formats, or both.',
        {
          sheet: sheetParam,
          range: rangeParam,
          applyTo: z
            .enum(['contents', 'formats', 'all'])
            .optional()
            .describe("What to clear. Default: 'contents'."),
        },
        async (args) =>
          gatedExec(rpc, gate, 'excel_clear_range', 'clear_range', args),
      ),
      tool(
        'excel_add_worksheet',
        'Add a new worksheet with the given name and activate it.',
        { name: z.string().describe('Name for the new worksheet.') },
        async (args) =>
          gatedExec(rpc, gate, 'excel_add_worksheet', 'add_worksheet', args),
      ),
      tool(
        'excel_format_range',
        'Apply formatting to a range: number format, bold, fill color, font color.',
        {
          sheet: sheetParam,
          range: rangeParam,
          numberFormat: z
            .string()
            .optional()
            .describe(
              "Excel number format string, e.g. '#,##0.00' or 'yyyy-mm-dd'.",
            ),
          bold: z.boolean().optional(),
          fillColor: z
            .string()
            .optional()
            .describe("Hex color, e.g. '#FFFF00'."),
          fontColor: z
            .string()
            .optional()
            .describe("Hex color, e.g. '#FF0000'."),
        },
        async (args) =>
          gatedExec(rpc, gate, 'excel_format_range', 'format_range', args),
      ),
      tool(
        'excel_find',
        'Find cells whose value contains the query string. Scans the used range of one sheet (or the active sheet) and returns matching cell addresses and values (first 100 matches).',
        {
          query: z
            .string()
            .describe('Substring to search for (case-insensitive).'),
          sheet: sheetParam,
        },
        async (args) => gatedExec(rpc, gate, 'excel_find', 'find', args),
      ),
    ],
  });
}
