/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock undici
const mockRequest = vi.fn();

vi.mock('undici', async () => ({
  request: mockRequest,
  Agent: vi.fn(),
}));

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
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('authenticateWithMolimate', () => {
    it('should authenticate successfully with valid employee ID', async () => {
      const mockResponse = {
        body: {
          json: async () => ({
            success: true,
            data: {
              userId: 'user123',
              token: 'mock-jwt-token',
              expiresAt: '2026-03-25T13:00:00Z',
            },
          }),
        },
      };

      mockRequest.mockResolvedValue(mockResponse);

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('EMP001', false);

      expect(response.success).toBe(true);
      expect(response.data?.userId).toBe('user123');
      expect(response.data?.token).toBe('mock-jwt-token');
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('molimate.example.com'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(Buffer),
        }),
      );
    });

    it('should handle new user registration', async () => {
      const mockResponse = {
        body: {
          json: async () => ({
            success: true,
            data: {
              userId: 'new-user-123',
              token: 'new-user-token',
            },
          }),
        },
      };

      mockRequest.mockResolvedValue(mockResponse);

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('NEW001', true);

      expect(response.success).toBe(true);
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should handle authentication failure', async () => {
      const mockResponse = {
        body: {
          json: async () => ({
            success: false,
            message: 'Invalid employee ID',
          }),
        },
      };

      mockRequest.mockResolvedValue(mockResponse);

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('INVALID001', false);

      expect(response.success).toBe(false);
      expect(response.message).toBe('Invalid employee ID');
      expect(response.data).toBeUndefined();
    });

    it('should handle network timeout', async () => {
      mockRequest.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('ETIMEDOUT')), 130000);
          }),
      );

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );

      await expect(authenticateWithMolimate('EMP001', false)).rejects.toThrow();
      vi.advanceTimersByTime(130000);
    });

    it('should use default timeout (120 seconds)', async () => {
      const mockResponse = {
        body: {
          json: async () => ({
            success: true,
            data: {
              userId: 'user123',
              token: 'mock-token',
            },
          }),
        },
      };

      mockRequest.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse), 100);
          }),
      );

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      await authenticateWithMolimate('EMP001', false);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headersTimeout: 120000,
          bodyTimeout: 120000,
        }),
      );
    });

    it('should handle custom timeout', async () => {
      const mockResponse = {
        body: {
          json: async () => ({
            success: true,
            data: {
              userId: 'user123',
              token: 'mock-token',
            },
          }),
        },
      };

      mockRequest.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse), 100);
          }),
      );

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      await authenticateWithMolimate('EMP001', false, 60000);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headersTimeout: 60000,
          bodyTimeout: 60000,
        }),
      );
    });

    it('should handle server error (500)', async () => {
      mockRequest.mockRejectedValue(
        new Error('Response timeout or server error'),
      );

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );

      await expect(authenticateWithMolimate('EMP001', false)).rejects.toThrow();
    });

    it('should handle invalid JSON response', async () => {
      mockRequest.mockResolvedValue({
        body: {
          json: async () => {
            throw new Error('Invalid JSON');
          },
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

      await expect(authenticateWithMolimate('EMP001', false)).rejects.toThrow(
        'Configuration not found',
      );
    });
  });

  describe('MolimateAuthResponse types', () => {
    it('should return valid response structure on success', async () => {
      const mockResponse = {
        body: {
          json: async () => ({
            success: true,
            data: {
              userId: 'user123',
              token: 'token',
              expiresAt: '2026-12-31T23:59:59Z',
            },
          }),
        },
      };

      mockRequest.mockResolvedValue(mockResponse);

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('EMP001', false);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.userId).toBe('user123');
      expect(response.data?.token).toBe('token');
      expect(response.data?.expiresAt).toBe('2026-12-31T23:59:59Z');
    });

    it('should return response with error message on failure', async () => {
      const mockResponse = {
        body: {
          json: async () => ({
            success: false,
            message: 'Authentication failed',
          }),
        },
      };

      mockRequest.mockResolvedValue(mockResponse);

      const { authenticateWithMolimate } = await import(
        './molimateAuthService.js'
      );
      const response = await authenticateWithMolimate('INVALID', false);

      expect(response.success).toBe(false);
      expect(response.message).toBe('Authentication failed');
      expect(response.data).toBeUndefined();
    });
  });
});
