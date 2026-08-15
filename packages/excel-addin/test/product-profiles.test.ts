import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadProductProfileCatalog,
  ProductProfileError,
  resolveEnabledGlobalAgents,
} from '../src/sidecar/product-profiles.js';

const CATALOG_PATH = fileURLToPath(
  new URL('../profiles/product-profiles.json', import.meta.url),
);

const ACCOUNTING_TOOL_ALLOWLIST = [
  'mcp__excel__excel_get_workbook_overview',
  'mcp__excel__excel_read_range',
  'mcp__excel__excel_find',
  'mcp__excel__excel_get_selection',
  'mcp__excel__excel_add_worksheet',
  'mcp__excel__excel_write_range',
  'mcp__excel__excel_set_formulas',
  'mcp__excel__excel_format_range',
];

const ACCOUNTING_PROMPT_LINES = [
  'You are the Molicode for Global accounting-report specialist operating on the open Excel workbook.',
  'Inspect the workbook and identify the accounting source sheet and range before proposing or performing writes.',
  'If required columns, reporting period, currency, or accounting basis are ambiguous, do not write anything; return one precise clarification question to the parent agent.',
  'Never invent, estimate, silently repair, or overwrite source accounting values.',
  'Create a new worksheet named 회계보고서. If it exists, use 회계보고서 (2), then (3), increasing until an unused name is found.',
  'Include report scope and as-of metadata, primary totals, account or category summaries, anomalous or incomplete entries, reconciliation results, and source sheet/range references.',
  'Use Excel formulas instead of copied constants whenever the result can remain traceable to source cells.',
  'Apply readable accounting number formats, headings, and exception emphasis.',
  "Preserve the workbook language when identifiable; otherwise use the user's language.",
  'Leave every existing worksheet unchanged. All writes require the normal Excel permission flow.',
  'Return completion details or the exact clarification/blocker to the parent agent.',
];

describe('product profiles', () => {
  const temporaryPaths: string[] = [];

  afterEach(() => {
    for (const temporaryPath of temporaryPaths.splice(0)) {
      fs.rmSync(temporaryPath, { force: true });
    }
  });

  function loadRawCatalog(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as Record<
      string,
      unknown
    >;
  }

  function writeCatalog(catalog: unknown): string {
    const catalogPath = path.join(
      os.tmpdir(),
      `moli-product-profiles-${Date.now()}-${temporaryPaths.length}.json`,
    );
    fs.writeFileSync(catalogPath, JSON.stringify(catalog));
    temporaryPaths.push(catalogPath);
    return catalogPath;
  }

  it('rejects an unsupported catalog schema version', () => {
    const rawCatalog = loadRawCatalog();
    rawCatalog.schemaVersion = 2;

    expect(() => loadProductProfileCatalog(writeCatalog(rawCatalog))).toThrow(
      ProductProfileError,
    );
  });

  it('rejects duplicate edition IDs', () => {
    const rawCatalog = loadRawCatalog();
    const editions = rawCatalog.editions as Array<Record<string, unknown>>;
    editions.push({ ...editions[0] });

    expect(() => loadProductProfileCatalog(writeCatalog(rawCatalog))).toThrow(
      ProductProfileError,
    );
  });

  it('rejects duplicate Global tool IDs', () => {
    const rawCatalog = loadRawCatalog();
    const globalTools = rawCatalog.globalTools as Array<
      Record<string, unknown>
    >;
    globalTools.push({ ...globalTools[0] });

    expect(() => loadProductProfileCatalog(writeCatalog(rawCatalog))).toThrow(
      ProductProfileError,
    );
  });

  it('rejects edition defaults that reference an unknown Global tool', () => {
    const rawCatalog = loadRawCatalog();
    const editions = rawCatalog.editions as Array<Record<string, unknown>>;
    editions[1].defaultGlobalTools = ['unknown-tool'];

    expect(() => loadProductProfileCatalog(writeCatalog(rawCatalog))).toThrow(
      ProductProfileError,
    );
  });

  it('isolates valid Global tool IDs when Standard configuration is tampered', () => {
    const catalog = loadProductProfileCatalog(CATALOG_PATH);

    expect(
      resolveEnabledGlobalAgents(catalog, {
        edition: 'standard',
        enabledGlobalTools: ['accounting-report'],
      }),
    ).toEqual([]);
  });

  it('resolves the enabled Global accounting specialist as a session agent', () => {
    const catalog = loadProductProfileCatalog(CATALOG_PATH);

    expect(
      resolveEnabledGlobalAgents(catalog, {
        edition: 'global',
        enabledGlobalTools: ['accounting-report'],
      }),
    ).toEqual([
      {
        name: 'global-accounting-report',
        description:
          'Use proactively for accounting, ledger, financial close, reconciliation, expense, trial-balance, or financial-summary report requests in the open Excel workbook.',
        tools: ACCOUNTING_TOOL_ALLOWLIST,
        systemPrompt: ACCOUNTING_PROMPT_LINES.join('\n'),
        level: 'session',
      },
    ]);
  });

  it('rejects unknown configured Global tool IDs before Standard isolation', () => {
    const catalog = loadProductProfileCatalog(CATALOG_PATH);

    expect(() =>
      resolveEnabledGlobalAgents(catalog, {
        edition: 'standard',
        enabledGlobalTools: ['unknown-tool'],
      }),
    ).toThrow(ProductProfileError);
  });
});
