/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkForRemoteUpdates } from './remoteVersionCheck.js';

const getMolimateConfigSafe = vi.hoisted(() => vi.fn());
vi.mock('../../constants/molimateConfig.js', () => ({
  getMolimateConfigSafe,
}));

const getCliVersion = vi.hoisted(() => vi.fn());
vi.mock('../../utils/version.js', () => ({
  getCliVersion,
}));

// Mock i18n: simulate translation by returning a readable string with params
vi.mock('../../i18n/index.js', () => ({
  t: (key: string, params?: Record<string, string>) => {
    if (key === 'remote.update.available' && params) {
      return `Update available! ${params['current']} → ${params['latest']}`;
    }
    if (key === 'remote.update.download') {
      return 'Download';
    }
    return key;
  },
}));

describe('checkForRemoteUpdates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env['DEV'];
    getCliVersion.mockResolvedValue('0.1.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null when DEV=true', async () => {
    process.env['DEV'] = 'true';
    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should return null when config is missing', async () => {
    getMolimateConfigSafe.mockReturnValue(null);
    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should return null when config has no url', async () => {
    getMolimateConfigSafe.mockReturnValue({
      molimateAuthUrl: 'https://example.com',
      defaultBaseUrl: 'https://example.com',
      models: [],
    });
    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should return null when remote version is older', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });
    getCliVersion.mockResolvedValue('1.0.0');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            version: '0.9.0',
          }),
      }),
    );

    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should return null when versions are equal', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });
    getCliVersion.mockResolvedValue('1.0.0');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0' }),
      }),
    );

    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should return update result when remote version is newer', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });
    getCliVersion.mockResolvedValue('0.1.0');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            version: '0.2.0',
            downloadUrl: 'https://mollycode.com/download',
            releaseNotes: 'Bug fixes and improvements',
          }),
      }),
    );

    const result = await checkForRemoteUpdates();
    expect(result).not.toBeNull();
    expect(result!.message).toContain('0.1.0');
    expect(result!.message).toContain('0.2.0');
    expect(result!.message).toContain('https://mollycode.com/download');
    expect(result!.message).toContain('Bug fixes and improvements');
  });

  it('should return update result without optional fields', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });
    getCliVersion.mockResolvedValue('0.1.0');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '0.2.0' }),
      }),
    );

    const result = await checkForRemoteUpdates();
    expect(result).not.toBeNull();
    expect(result!.message).toContain('0.1.0');
    expect(result!.message).toContain('0.2.0');
    expect(result!.message).not.toContain('remote.update.download');
  });

  it('should include box drawing characters in notification', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });
    getCliVersion.mockResolvedValue('0.1.0');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '0.2.0' }),
      }),
    );

    const result = await checkForRemoteUpdates();
    expect(result).not.toBeNull();
    expect(result!.message).toContain('╭');
    expect(result!.message).toContain('╰');
  });

  it('should return null on network error', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should return null on non-ok response', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should return null for invalid semver in response', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: 'not-a-version' }),
      }),
    );

    const result = await checkForRemoteUpdates();
    expect(result).toBeNull();
  });

  it('should strip trailing slashes from url', async () => {
    getMolimateConfigSafe.mockReturnValue({
      url: 'https://example.com/',
    });
    getCliVersion.mockResolvedValue('0.1.0');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '0.2.0' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await checkForRemoteUpdates();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/version.json',
      expect.any(Object),
    );
  });
});
