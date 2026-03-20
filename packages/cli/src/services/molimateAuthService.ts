/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDebugLogger } from '@dobby/moli-code-core';
import { formatTLSError, initializeCustomCerts } from '../utils/httpsAgent.js';
import { t } from '../i18n/index.js';

const logger = createDebugLogger('MOLIMATE_AUTH_SERVICE');

// Inject Windows system certificates into Node.js trust store on startup
initializeCustomCerts();

const MOLIMATE_URL = 'https://testai.api.com/api/auth/login';
const DEFAULT_TIMEOUT_MS = 120000; // 120 seconds

export interface MolimateAuthRequest {
  username: string;
  newJoinYn: 'Y' | 'N';
}

export interface MolimateAuthResponse {
  success: boolean;
  message?: string;
  data?: {
    userId?: string;
    token?: string;
    expiresAt?: string;
  };
}

/**
 * Authenticate with Molimate using employee ID
 * @param username - The employee ID (alphanumeric only)
 * @param isNewJoin - Whether this is a new join user
 * @param timeoutMs - Request timeout in milliseconds (default: 120000ms = 120 seconds)
 * @returns Promise with authentication response
 */
export async function authenticateWithMolimate(
  username: string,
  isNewJoin: boolean = false,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<MolimateAuthResponse> {
  logger.debug('Authenticating with Molimate:', {
    username,
    isNewJoin,
    timeoutMs,
  });

  // Create AbortController with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MOLIMATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        newJoinYn: isNewJoin ? 'Y' : 'N',
      } as MolimateAuthRequest),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Molimate auth failed:', response.status, errorText);
      return {
        success: false,
        message: t(
          'Molimate authentication failed: {{status}} {{statusText}}',
          {
            status: String(response.status),
            statusText: response.statusText,
          },
        ),
      };
    }

    const data = (await response.json()) as MolimateAuthResponse;
    logger.debug('Molimate auth response:', data);
    return data;
  } catch (error) {
    // Clear timeout if request completes before timeout
    clearTimeout(timeoutId);

    // Handle abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Molimate auth timed out');
      return {
        success: false,
        message: t('Authentication request timed out. Please try again.'),
      };
    }

    // Format error with TLS-specific handling
    const formattedError = formatTLSError(error);
    logger.error('Molimate auth error:', formattedError);

    return {
      success: false,
      message: formattedError,
    };
  } finally {
    // Always clear timeout
    clearTimeout(timeoutId);
  }
}

/**
 * Validate employee ID format (alphanumeric only)
 * @param employeeId - The employee ID to validate
 * @returns true if valid, false otherwise
 */
export function validateEmployeeId(employeeId: string): boolean {
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(employeeId);
}
