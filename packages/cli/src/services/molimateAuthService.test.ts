/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock dependencies
vi.mock('../constants/molimateConfig.js', () => ({
  getMolimateConfig: vi.fn(() => ({
    molimateAuthUrl: 'https://molimate.example.com/api/auth',
    defaultBaseUrl: 'https://api.molimate.example.com/v1',
    models: [],
  })),
}));

vi.mock('../utils/httpsAgent.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    initializeCustomCerts: vi.fn(),
  };
});

vi.mock('@dobby/moli-code-core', () => ({
  createDebugLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  })),
}));

describe('molimateAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateWithMolimate', () => {
    it('should authenticate successfully with valid employee ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            userId: 'user123',
            token: 'mock-jwt-token',
            expiresAt: '2026-03-25T13:00:00Z',
          },
        }),
      });

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('EMP001', false);

      expect(response.success).toBe(true);
      expect(response.data?.userId).toBe('user123');
      expect(response.data?.token).toBe('mock-jwt-token');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('molimate.example.com'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
      );
    });

    it('should handle new user registration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            userId: 'new-user-123',
            token: 'new-user-token',
          },
        }),
      });

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('NEW001', true);

      expect(response.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle authentication failure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          message: 'Invalid employee ID',
        }),
      });

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('INVALID001', false);

      expect(response.success).toBe(false);
      expect(response.message).toBe('Invalid employee ID');
      expect(response.data).toBeUndefined();
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );

      const response = await authenticateWithMolimate('EMP001', false);
      expect(response.success).toBe(false);
      expect(response.message).toContain('Network error');
    });

    it('should handle HTTP error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server Error',
      });

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('EMP001', false);

      expect(response.success).toBe(false);
      expect(response.message).toContain('500');
    });

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('EMP001', false);

      expect(response.success).toBe(false);
      expect(response.message).toContain('Invalid JSON');
    });

    it('should handle missing configuration', async () => {
      const { getMolimateConfig } = await import(
        '../constants/molimateConfig.js'
      );
      vi.mocked(getMolimateConfig).mockImplementation(() => {
        throw new Error('Configuration not found');
      });

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );

      const response = await authenticateWithMolimate('EMP001', false);
      expect(response.success).toBe(false);
    });
  });
});
