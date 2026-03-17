/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AuthType,
  moliOAuth2Events,
  MoliOAuth2Event,
  type DeviceAuthorizationData,
} from '@dobby/moli-code-core';

export interface MoliAuthState {
  deviceAuth: DeviceAuthorizationData | null;
  authStatus:
    | 'idle'
    | 'polling'
    | 'success'
    | 'error'
    | 'timeout'
    | 'rate_limit';
  authMessage: string | null;
}

export const useMoliAuth = (
  pendingAuthType: AuthType | undefined,
  isAuthenticating: boolean,
) => {
  const [moliAuthState, setMoliAuthState] = useState<MoliAuthState>({
    deviceAuth: null,
    authStatus: 'idle',
    authMessage: null,
  });

  const isMoliAuth = pendingAuthType === AuthType.MOLI_OAUTH;

  // Set up event listeners when authentication starts
  useEffect(() => {
    if (!isMoliAuth || !isAuthenticating) {
      // Reset state when not authenticating or not Qwen auth
      setMoliAuthState({
        deviceAuth: null,
        authStatus: 'idle',
        authMessage: null,
      });
      return;
    }

    setMoliAuthState((prev) => ({
      ...prev,
      authStatus: 'idle',
    }));

    // Set up event listeners
    const handleDeviceAuth = (deviceAuth: DeviceAuthorizationData) => {
      setMoliAuthState((prev) => ({
        ...prev,
        deviceAuth: {
          verification_uri: deviceAuth.verification_uri,
          verification_uri_complete: deviceAuth.verification_uri_complete,
          user_code: deviceAuth.user_code,
          expires_in: deviceAuth.expires_in,
          device_code: deviceAuth.device_code,
        },
        authStatus: 'polling',
      }));
    };

    const handleAuthProgress = (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => {
      setMoliAuthState((prev) => ({
        ...prev,
        authStatus: status,
        authMessage: message || null,
      }));
    };

    // Add event listeners
    moliOAuth2Events.on(MoliOAuth2Event.AuthUri, handleDeviceAuth);
    moliOAuth2Events.on(MoliOAuth2Event.AuthProgress, handleAuthProgress);

    // Cleanup event listeners when component unmounts or auth finishes
    return () => {
      moliOAuth2Events.off(MoliOAuth2Event.AuthUri, handleDeviceAuth);
      moliOAuth2Events.off(MoliOAuth2Event.AuthProgress, handleAuthProgress);
    };
  }, [isMoliAuth, isAuthenticating]);

  const cancelMoliAuth = useCallback(() => {
    // Emit cancel event to stop polling
    moliOAuth2Events.emit(MoliOAuth2Event.AuthCancel);

    setMoliAuthState({
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
  }, []);

  return {
    moliAuthState,
    cancelMoliAuth,
  };
};
