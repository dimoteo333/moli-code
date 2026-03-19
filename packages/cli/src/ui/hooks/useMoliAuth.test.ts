/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DeviceAuthorizationData } from '@dobby/moli-code-core';
import { useMoliAuth } from './useMoliAuth.js';
import {
  AuthType,
  moliOAuth2Events,
  MoliOAuth2Event,
} from '@dobby/moli-code-core';

// Mock the moliOAuth2Events
vi.mock('@dobby/moli-code-core', async () => {
  const actual = await vi.importActual('@dobby/moli-code-core');
  const mockEmitter = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
  };
  return {
    ...actual,
    moliOAuth2Events: mockEmitter,
    MoliOAuth2Event: {
      AuthUri: 'authUri',
      AuthProgress: 'authProgress',
    },
  };
});

const mockMoliOAuth2Events = vi.mocked(moliOAuth2Events);

describe('useMoliAuth', () => {
  const mockDeviceAuth: DeviceAuthorizationData = {
    verification_uri: 'https://oauth.moli.com/device',
    verification_uri_complete: 'https://oauth.moli.com/device?user_code=ABC123',
    user_code: 'ABC123',
    expires_in: 1800,
    device_code: 'device_code_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state when not Moli auth', () => {
    const { result } = renderHook(() =>
      useMoliAuth(AuthType.USE_GEMINI, false),
    );

    expect(result.current.moliAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelMoliAuth).toBeInstanceOf(Function);
  });

  it('should initialize with default state when Moli auth but not authenticating', () => {
    const { result } = renderHook(() =>
      useMoliAuth(AuthType.MOLI_OAUTH, false),
    );

    expect(result.current.moliAuthState).toEqual({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
    expect(result.current.cancelMoliAuth).toBeInstanceOf(Function);
  });

  it('should set up event listeners when Moli auth and authenticating', () => {
    renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    expect(mockMoliOAuth2Events.on).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockMoliOAuth2Events.on).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should handle device auth event', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.moliAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.moliAuthState.authStatus).toBe('polling');
  });

  it('should handle auth progress event - success', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    act(() => {
      handleAuthProgress!('success', 'Authentication successful!');
    });

    expect(result.current.moliAuthState.authStatus).toBe('success');
    expect(result.current.moliAuthState.authMessage).toBe(
      'Authentication successful!',
    );
  });

  it('should handle auth progress event - error', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    act(() => {
      handleAuthProgress!('error', 'Authentication failed');
    });

    expect(result.current.moliAuthState.authStatus).toBe('error');
    expect(result.current.moliAuthState.authMessage).toBe(
      'Authentication failed',
    );
  });

  it('should handle auth progress event - polling', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    act(() => {
      handleAuthProgress!('polling', 'Waiting for user authorization...');
    });

    expect(result.current.moliAuthState.authStatus).toBe('polling');
    expect(result.current.moliAuthState.authMessage).toBe(
      'Waiting for user authorization...',
    );
  });

  it('should handle auth progress event - rate_limit', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    act(() => {
      handleAuthProgress!(
        'rate_limit',
        'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
      );
    });

    expect(result.current.moliAuthState.authStatus).toBe('rate_limit');
    expect(result.current.moliAuthState.authMessage).toBe(
      'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
    );
  });

  it('should handle auth progress event without message', () => {
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    act(() => {
      handleAuthProgress!('success');
    });

    expect(result.current.moliAuthState.authStatus).toBe('success');
    expect(result.current.moliAuthState.authMessage).toBe(null);
  });

  it('should clean up event listeners when auth type changes', () => {
    const { rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        useMoliAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.MOLI_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Change to non-Moli auth
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(mockMoliOAuth2Events.off).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockMoliOAuth2Events.off).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners when authentication stops', () => {
    const { rerender } = renderHook(
      ({ isAuthenticating }) =>
        useMoliAuth(AuthType.MOLI_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(mockMoliOAuth2Events.off).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockMoliOAuth2Events.off).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useMoliAuth(AuthType.MOLI_OAUTH, true),
    );

    unmount();

    expect(mockMoliOAuth2Events.off).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockMoliOAuth2Events.off).toHaveBeenCalledWith(
      MoliOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should reset state when switching from Moli auth to another auth type', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ pendingAuthType, isAuthenticating }) =>
        useMoliAuth(pendingAuthType, isAuthenticating),
      {
        initialProps: {
          pendingAuthType: AuthType.MOLI_OAUTH,
          isAuthenticating: true,
        },
      },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.moliAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.moliAuthState.authStatus).toBe('polling');

    // Switch to different auth type
    rerender({ pendingAuthType: AuthType.USE_GEMINI, isAuthenticating: true });

    expect(result.current.moliAuthState.deviceAuth).toBe(null);
    expect(result.current.moliAuthState.authStatus).toBe('idle');
    expect(result.current.moliAuthState.authMessage).toBe(null);
  });

  it('should reset state when authentication stops', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ isAuthenticating }) =>
        useMoliAuth(AuthType.MOLI_OAUTH, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.moliAuthState.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.moliAuthState.authStatus).toBe('polling');

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(result.current.moliAuthState.deviceAuth).toBe(null);
    expect(result.current.moliAuthState.authStatus).toBe('idle');
    expect(result.current.moliAuthState.authMessage).toBe(null);
  });

  it('should handle cancelMoliAuth function', () => {
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationData) => void;

    mockMoliOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === MoliOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockMoliOAuth2Events;
    });

    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    // Set up some state
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.moliAuthState.deviceAuth).toEqual(mockDeviceAuth);

    // Cancel auth
    act(() => {
      result.current.cancelMoliAuth();
    });

    expect(result.current.moliAuthState.deviceAuth).toBe(null);
    expect(result.current.moliAuthState.authStatus).toBe('idle');
    expect(result.current.moliAuthState.authMessage).toBe(null);
  });

  it('should handle different auth types correctly', () => {
    // Test with Moli OAuth - should set up event listeners when authenticating
    const { result: moliResult } = renderHook(() =>
      useMoliAuth(AuthType.MOLI_OAUTH, true),
    );
    expect(moliResult.current.moliAuthState.authStatus).toBe('idle');
    expect(mockMoliOAuth2Events.on).toHaveBeenCalled();

    // Test with other auth types - should not set up event listeners
    const { result: geminiResult } = renderHook(() =>
      useMoliAuth(AuthType.USE_GEMINI, true),
    );
    expect(geminiResult.current.moliAuthState.authStatus).toBe('idle');

    const { result: oauthResult } = renderHook(() =>
      useMoliAuth(AuthType.USE_OPENAI, true),
    );
    expect(oauthResult.current.moliAuthState.authStatus).toBe('idle');
  });

  it('should initialize with idle status when starting authentication with Moli auth', () => {
    const { result } = renderHook(() => useMoliAuth(AuthType.MOLI_OAUTH, true));

    expect(result.current.moliAuthState.authStatus).toBe('idle');
    expect(mockMoliOAuth2Events.on).toHaveBeenCalled();
  });
});
