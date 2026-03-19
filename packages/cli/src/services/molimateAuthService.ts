/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDebugLogger } from '@dobby/moli-code-core';

const logger = createDebugLogger('MOLIMATE_AUTH_SERVICE');

const MOLIMATE_URL = 'https://apiauth.molicode.com/api/moliauth';

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
 * @returns Promise with authentication response
 */
export async function authenticateWithMolimate(
  username: string,
  isNewJoin: boolean = false,
): Promise<MolimateAuthResponse> {
  logger.debug('Authenticating with Molimate:', { username, isNewJoin });

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
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Molimate auth failed:', response.status, errorText);
      return {
        success: false,
        message: `Authentication failed: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as MolimateAuthResponse;
    logger.debug('Molimate auth response:', data);
    return data;
  } catch (error) {
    logger.error('Molimate auth error:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    };
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
