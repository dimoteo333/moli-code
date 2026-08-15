import * as fs from 'node:fs';
import type { SubagentConfig } from '@dobby/moli-code-sdk';
import { z } from 'zod';
import type { ProductEdition } from './config.js';

const nonEmptyString = z.string().min(1);

const ACCOUNTING_REPORT_ID = 'accounting-report';
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

const productProfileCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  editions: z.array(
    z.object({
      id: nonEmptyString,
      menuLabel: nonEmptyString,
      displayName: nonEmptyString,
      description: nonEmptyString,
      icons: z.object({
        app16: nonEmptyString,
        app32: nonEmptyString,
        app64: nonEmptyString,
        app80: nonEmptyString,
        ribbon16: nonEmptyString,
        ribbon32: nonEmptyString,
        ribbon80: nonEmptyString,
      }),
      defaultGlobalTools: z.array(nonEmptyString),
    }),
  ),
  globalTools: z.array(
    z.object({
      id: nonEmptyString,
      agent: z.object({
        name: nonEmptyString,
        description: nonEmptyString,
        tools: z.array(nonEmptyString).min(1),
        systemPromptLines: z.array(nonEmptyString).min(1),
        modelConfig: z
          .object({
            model: z.string().optional(),
            temp: z.number().optional(),
            top_p: z.number().optional(),
          })
          .optional(),
        runConfig: z
          .object({
            max_time_minutes: z.number().optional(),
            max_turns: z.number().optional(),
          })
          .optional(),
      }),
    }),
  ),
});

export type ProductProfileCatalog = z.infer<typeof productProfileCatalogSchema>;

export interface GlobalAgentSettings {
  edition: ProductEdition;
  enabledGlobalTools: readonly string[];
}

/** A stable error for invalid catalog data or unsupported Global-tool config. */
export class ProductProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductProfileError';
  }
}

/**
 * Loads the shared catalog and validates cross-record constraints that cannot
 * be expressed by the structural Zod schema alone.
 */
export function loadProductProfileCatalog(
  catalogPath: string,
): ProductProfileCatalog {
  let rawCatalog: unknown;
  try {
    rawCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (error) {
    throw new ProductProfileError(
      `Unable to load product profile catalog: ${formatError(error)}`,
    );
  }

  const parsed = productProfileCatalogSchema.safeParse(rawCatalog);
  if (!parsed.success) {
    throw new ProductProfileError(
      `Invalid product profile catalog: ${parsed.error.message}`,
    );
  }

  const catalog = parsed.data;
  assertUniqueIds(
    catalog.editions.map((edition) => edition.id),
    'edition',
  );
  assertUniqueIds(
    catalog.globalTools.map((globalTool) => globalTool.id),
    'Global tool',
  );
  assertAccountingReportAllowlist(catalog);

  const knownGlobalToolIds = new Set(
    catalog.globalTools.map((globalTool) => globalTool.id),
  );
  for (const edition of catalog.editions) {
    for (const toolId of edition.defaultGlobalTools) {
      if (!knownGlobalToolIds.has(toolId)) {
        throw new ProductProfileError(
          `Edition "${edition.id}" references unknown Global tool "${toolId}".`,
        );
      }
    }
  }

  return catalog;
}

/**
 * Returns only Global tools explicitly enabled by the configuration. Known IDs
 * are validated before Standard-edition isolation is applied.
 */
export function resolveEnabledGlobalAgents(
  catalog: ProductProfileCatalog,
  settings: GlobalAgentSettings,
): SubagentConfig[] {
  const globalToolsById = new Map(
    catalog.globalTools.map((globalTool) => [globalTool.id, globalTool]),
  );

  for (const toolId of settings.enabledGlobalTools) {
    if (!globalToolsById.has(toolId)) {
      throw new ProductProfileError(
        `Configured Global tool "${toolId}" is not defined by the product profile catalog.`,
      );
    }
  }

  if (settings.edition !== 'global') {
    return [];
  }

  return settings.enabledGlobalTools.map((toolId) => {
    const globalTool = globalToolsById.get(toolId);
    if (!globalTool) {
      throw new ProductProfileError(
        `Configured Global tool "${toolId}" is not defined by the product profile catalog.`,
      );
    }

    const { agent } = globalTool;
    return {
      name: agent.name,
      description: agent.description,
      tools: [...agent.tools],
      systemPrompt: agent.systemPromptLines.join('\n'),
      level: 'session',
      ...(agent.modelConfig ? { modelConfig: agent.modelConfig } : {}),
      ...(agent.runConfig ? { runConfig: agent.runConfig } : {}),
    };
  });
}

function assertUniqueIds(ids: readonly string[], kind: string): void {
  const uniqueIds = new Set<string>();
  for (const id of ids) {
    if (uniqueIds.has(id)) {
      throw new ProductProfileError(`Duplicate ${kind} ID "${id}".`);
    }
    uniqueIds.add(id);
  }
}

function assertAccountingReportAllowlist(catalog: ProductProfileCatalog): void {
  const accountingReport = catalog.globalTools.find(
    (globalTool) => globalTool.id === ACCOUNTING_REPORT_ID,
  );
  if (
    accountingReport &&
    !hasExactToolOrder(accountingReport.agent.tools, ACCOUNTING_TOOL_ALLOWLIST)
  ) {
    throw new ProductProfileError(
      'Accounting-report tools must exactly match the approved Excel allowlist in order.',
    );
  }
}

function hasExactToolOrder(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((toolName, index) => toolName === expected[index])
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
