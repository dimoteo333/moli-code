/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MolimateModelDef {
  id: string;
  displayName: string;
  description: string;
  envKey: string;
  apiKey: string;
}

export interface MolimateConfig {
  url?: string;
  molimateAuthUrl: string;
  defaultBaseUrl: string;
  models: MolimateModelDef[];
}

let cached: MolimateConfig | null = null;

/**
 * Resolve the path to molimate.config.json.
 *
 * Works in three modes:
 * - Dev (ts-node):  src/constants/molimateConfig.ts  -> ../../molimate.config.json
 * - Compiled:       dist/constants/molimateConfig.js -> ../../molimate.config.json
 * - Bundled:        dist/cli.js                      -> ./molimate.config.json
 */
function resolveConfigPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // Bundled mode: import.meta.url points to dist/cli.js (same dir as config)
  const bundledPath = resolve(thisDir, 'molimate.config.json');
  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  // Dev / compiled mode: go up two levels from src/constants or dist/constants
  return resolve(thisDir, '..', '..', 'molimate.config.json');
}

/**
 * Load molimate.config.json.
 * Throws if the file is missing — users must copy molimate.config.example.json.
 */
export function getMolimateConfig(): MolimateConfig {
  if (cached) {
    return cached;
  }

  const configPath = resolveConfigPath();

  try {
    const raw = readFileSync(configPath, 'utf-8');
    cached = JSON.parse(raw) as MolimateConfig;
    return cached;
  } catch {
    throw new Error(
      `Missing molimate.config.json at ${configPath}.\n` +
        'Copy molimate.config.example.json to molimate.config.json and fill in your values.',
    );
  }
}

/**
 * Non-throwing variant of getMolimateConfig.
 * Returns null if the config file is missing or unreadable.
 */
export function getMolimateConfigSafe(): MolimateConfig | null {
  try {
    return getMolimateConfig();
  } catch {
    return null;
  }
}

/**
 * Get a model definition by id. Returns undefined if not found.
 */
export function getMolimateModel(
  modelId: string,
): MolimateModelDef | undefined {
  return getMolimateConfig().models.find((m) => m.id === modelId);
}

/**
 * Get the API key for a model by id. Returns undefined if not found.
 */
export function getMolimateApiKey(modelId: string): string | undefined {
  return getMolimateModel(modelId)?.apiKey;
}
