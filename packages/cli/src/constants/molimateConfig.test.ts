/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  fetchRemoteMolimateConfig,
  resetRemoteConfigCache,
  _internal,
} from './molimateConfig.js';
import type { MolimateModelDef } from './molimateConfig.js';

describe('fetchRemoteMolimateConfig', () => {
  const localConfig = {
    url: 'https://example.com',
    molimateAuthUrl: 'local-auth-url',
    defaultBaseUrl: 'local-base-url',
    models: [] as MolimateModelDef[],
  };

  const validRemoteConfig = {
    molimateAuthUrl: 'https://auth.example.com/api/auth/login',
    defaultBaseUrl: 'https://api.example.com/v1',
    models: [
      {
        id: 'model-1',
        displayName: 'Model One',
        description: 'First model',
        envKey: 'MODEL_API_KEY_1',
        apiKey: 'sk-test-key-1',
        baseUrl: 'https://api.example.com/v1',
      },
    ],
  };

  let originalGetLocalConfig: typeof _internal.getLocalConfig;

  beforeEach(() => {
    vi.resetAllMocks();
    resetRemoteConfigCache();
    originalGetLocalConfig = _internal.getLocalConfig;
    _internal.getLocalConfig = () => localConfig;
  });

  afterEach(() => {
    _internal.getLocalConfig = originalGetLocalConfig;
    vi.restoreAllMocks();
  });

  it('should fetch and merge remote config with local url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validRemoteConfig),
      }),
    );

    const result = await fetchRemoteMolimateConfig();

    expect(result.url).toBe('https://example.com');
    expect(result.molimateAuthUrl).toBe(validRemoteConfig.molimateAuthUrl);
    expect(result.defaultBaseUrl).toBe(validRemoteConfig.defaultBaseUrl);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.id).toBe('model-1');
  });

  it('should return cached result on second call without re-fetching', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validRemoteConfig),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchRemoteMolimateConfig();
    await fetchRemoteMolimateConfig();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw when local config has no url field', async () => {
    _internal.getLocalConfig = () => ({
      molimateAuthUrl: 'auth-url',
      defaultBaseUrl: 'base-url',
      models: [],
    });

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow(
      'No url field in local molimate.config.json',
    );
  });

  it('should throw on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow('Network error');
  });

  it('should throw on non-200 HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow(
      'Remote config fetch failed: HTTP 500',
    );
  });

  it('should throw on missing molimateAuthUrl', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            defaultBaseUrl: 'https://api.example.com',
            models: validRemoteConfig.models,
          }),
      }),
    );

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow(
      'missing required field: molimateAuthUrl',
    );
  });

  it('should throw on missing defaultBaseUrl', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            molimateAuthUrl: 'https://auth.example.com',
            models: validRemoteConfig.models,
          }),
      }),
    );

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow(
      'missing required field: defaultBaseUrl',
    );
  });

  it('should throw on missing models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            molimateAuthUrl: 'https://auth.example.com',
            defaultBaseUrl: 'https://api.example.com',
          }),
      }),
    );

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow(
      'missing required field: models',
    );
  });

  it('should throw on empty models array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            molimateAuthUrl: 'https://auth.example.com',
            defaultBaseUrl: 'https://api.example.com',
            models: [],
          }),
      }),
    );

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow(
      'missing required field: models',
    );
  });

  it('should throw on model with missing required fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            molimateAuthUrl: 'https://auth.example.com',
            defaultBaseUrl: 'https://api.example.com',
            models: [{ id: 'test-model' }],
          }),
      }),
    );

    await expect(fetchRemoteMolimateConfig()).rejects.toThrow(
      'missing required fields: displayName, description, envKey, apiKey',
    );
  });

  it('should strip trailing slashes from url', async () => {
    _internal.getLocalConfig = () => ({
      ...localConfig,
      url: 'https://example.com/',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validRemoteConfig),
    });
    vi.stubGlobal('fetch', mockFetch);

    await fetchRemoteMolimateConfig();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/molimate.config.json',
      expect.any(Object),
    );
  });
});
