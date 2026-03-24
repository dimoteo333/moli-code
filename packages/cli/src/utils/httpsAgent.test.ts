/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock tls
const mockCreateSecureContext = vi.fn((options) => ({
  context: options,
}));

vi.mock('node:tls', async () => ({
  rootCertificates: ['mock-root-cert-1', 'mock-root-cert-2'],
  createSecureContext: mockCreateSecureContext,
}));

// Mock child_process
const mockExecSync = vi.fn();

vi.mock('node:child_process', async () => ({
  execSync: mockExecSync,
}));

// Mock logger
vi.mock('@dobby/moli-code-core', () => ({
  createDebugLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  })),
}));

describe('httpsAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Windows certificate extraction', () => {
    beforeEach(() => {
      vi.stubGlobal('process', {
        ...process,
        platform: 'win32',
      });
    });

    it('should extract certificates from Windows Root store', async () => {
      const mockCertOutput = `
================ Certificate 0 ================
Version: 3
Serial Number: 1234
Issuer: CN=Root CA
Subject: CN=Root CA
-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ
...
-----END CERTIFICATE-----
`;

      mockExecSync.mockReturnValue(mockCertOutput);

      // Import the module to trigger initialization
      await import('./httpsAgent.js');

      expect(mockExecSync).toHaveBeenCalledWith(
        'certutil -store Root',
        expect.objectContaining({
          encoding: 'utf-8',
          timeout: 15000,
          windowsHide: true,
        }),
      );
    });

    it('should extract certificates from Windows CA store', async () => {
      const mockCertOutput = `
================ Certificate 0 ================
Version: 3
Issuer: CN=CA
Subject: CN=CA
-----BEGIN CERTIFICATE-----
MIICLDCCAdKgAwIBAgIBADAKBggqhkjOPQQDAjB9MQswCQYDVQQGEwJCRTEPMA0G
...
-----END CERTIFICATE-----
`;

      mockExecSync.mockReturnValue(mockCertOutput);

      await import('./httpsAgent.js');

      expect(mockExecSync).toHaveBeenCalledWith(
        'certutil -store CA',
        expect.any(Object),
      );
    });

    it('should handle certutil command failure gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('certutil not found');
      });

      const { createDebugLogger } = await import('@dobby/moli-code-core');
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      vi.mocked(createDebugLogger).mockReturnValue(mockLogger);

      await import('./httpsAgent.js');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle empty certificate output', async () => {
      mockExecSync.mockReturnValue('');

      await import('./httpsAgent.js');

      // Should not crash with empty output
      expect(mockCreateSecureContext).toHaveBeenCalled();
    });
  });

  describe('TLS context patching', () => {
    beforeEach(() => {
      vi.stubGlobal('process', {
        ...process,
        platform: 'win32',
      });
    });

    it('should patch createSecureContext on Windows', async () => {
      mockExecSync.mockReturnValue(
        '-----BEGIN CERTIFICATE-----\nwindows-cert\n-----END CERTIFICATE-----',
      );

      await import('./httpsAgent.js');

      expect(mockCreateSecureContext).toHaveBeenCalled();
    });

    it('should not patch on non-Windows platforms', async () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('process', {
        ...process,
        platform: 'darwin',
      });

      await import('./httpsAgent.js');

      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle certutil timeout', async () => {
      vi.stubGlobal('process', {
        ...process,
        platform: 'win32',
      });

      mockExecSync.mockImplementation(() => {
        throw new Error('Command timed out');
      });

      const { createDebugLogger } = await import('@dobby/moli-code-core');
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      vi.mocked(createDebugLogger).mockReturnValue(mockLogger);

      await import('./httpsAgent.js');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
      );
      vi.unstubAllGlobals();
    });
  });
});
