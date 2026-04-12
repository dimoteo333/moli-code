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
  baseUrl?: string;
}

export interface MolimateConfig {
  url?: string;
  molimateAuthUrl: string;
  defaultBaseUrl: string;
  models: MolimateModelDef[];
}

let cached: MolimateConfig | null = null;
let cachedFromRemote = false;

const REMOTE_CONFIG_TIMEOUT_MS = 5000;

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

/**
 * Internal reference to getMolimateConfig, replaceable in tests.
 */
export const _internal = {
  getLocalConfig: (): MolimateConfig => getMolimateConfig(),
};

/**
 * Fetch molimate.config.json from the remote server.
 * Uses the local config's `url` field to determine the remote endpoint.
 * Validates required fields and caches the result.
 * Throws on any error (network, timeout, invalid response, missing fields).
 */
export async function fetchRemoteMolimateConfig(): Promise<MolimateConfig> {
  if (cached && cachedFromRemote) {
    return cached;
  }

  const localConfig = _internal.getLocalConfig();
  if (!localConfig.url) {
    throw new Error(
      'No url field in local molimate.config.json. Cannot fetch remote config.',
    );
  }

  const remoteUrl = `${localConfig.url.replace(/\/+$/, '')}/molimate.config.json`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REMOTE_CONFIG_TIMEOUT_MS,
  );

  try {
    const res = await fetch(remoteUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Remote config fetch failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as Partial<MolimateConfig>;

    // Validate required fields
    if (!data.molimateAuthUrl || typeof data.molimateAuthUrl !== 'string') {
      throw new Error(
        'Remote config is missing required field: molimateAuthUrl',
      );
    }
    if (!data.defaultBaseUrl || typeof data.defaultBaseUrl !== 'string') {
      throw new Error(
        'Remote config is missing required field: defaultBaseUrl',
      );
    }
    if (!Array.isArray(data.models) || data.models.length === 0) {
      throw new Error(
        'Remote config is missing required field: models (must be a non-empty array)',
      );
    }

    // Validate each model
    for (const m of data.models) {
      const missing: string[] = [];
      if (!m.id) missing.push('id');
      if (!m.displayName) missing.push('displayName');
      if (!m.description) missing.push('description');
      if (!m.envKey) missing.push('envKey');
      if (!m.apiKey) missing.push('apiKey');
      if (missing.length > 0) {
        throw new Error(
          `Remote config model "${m.id || 'unknown'}" is missing required fields: ${missing.join(', ')}`,
        );
      }
    }

    // Merge: url from local, everything else from remote
    const merged: MolimateConfig = {
      url: localConfig.url,
      molimateAuthUrl: data.molimateAuthUrl,
      defaultBaseUrl: data.defaultBaseUrl,
      models: data.models as MolimateModelDef[],
    };

    cached = merged;
    cachedFromRemote = true;
    return merged;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Reset the remote config cache. For testing only.
 */
export function resetRemoteConfigCache(): void {
  cached = null;
  cachedFromRemote = false;
}
