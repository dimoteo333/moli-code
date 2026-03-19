/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Qwen Connection Handler
 *
 * Handles Qwen Agent connection establishment, authentication, and session creation
 */

import type { AcpConnection } from './acpConnection.js';
import { isAuthenticationRequiredError } from '../utils/authErrors.js';
import { authMethod } from '../types/acpTypes.js';
import {
  extractModelInfoFromNewSessionResult,
  extractSessionModelState,
} from '../utils/acpModelInfo.js';
import type { ModelInfo } from '../types/acpTypes.js';

export interface MoliConnectionResult {
  sessionCreated: boolean;
  requiresAuth: boolean;
  modelInfo?: ModelInfo;
  availableModels?: ModelInfo[];
}

/**
 * Qwen Connection Handler class
 * Handles connection, authentication, and session initialization
 */
export class MoliConnectionHandler {
  /**
   * Connect to Qwen service and establish session
   *
   * @param connection - ACP connection instance
   * @param workingDir - Working directory
   * @param cliPath - CLI path (optional, if provided will override the path in configuration)
   */
  async connect(
    connection: AcpConnection,
    workingDir: string,
    cliEntryPath: string,
    options?: {
      autoAuthenticate?: boolean;
    },
  ): Promise<MoliConnectionResult> {
    const connectId = Date.now();
    console.log(`[MoliAgentManager] 🚀 CONNECT() CALLED - ID: ${connectId}`);
    const autoAuthenticate = options?.autoAuthenticate ?? true;
    let sessionCreated = false;
    let requiresAuth = false;
    let modelInfo: ModelInfo | undefined;
    let availableModels: ModelInfo[] | undefined;

    // Build extra CLI arguments (only essential parameters)
    const extraArgs: string[] = [];

    await connection.connect(cliEntryPath!, workingDir, extraArgs);

    // Try to restore existing session or create new session
    // Note: Auto-restore on connect is disabled to avoid surprising loads
    // when user opens a "New Chat" tab. Restoration is now an explicit action
    // (session selector → session/load) or handled by higher-level flows.
    const sessionRestored = false;

    // Create new session if unable to restore
    if (!sessionRestored) {
      console.log(
        '[MoliAgentManager] no sessionRestored, Creating new session...',
      );

      try {
        console.log(
          '[MoliAgentManager] Creating new session (letting CLI handle authentication)...',
        );
        const newSessionResult = await this.newSessionWithRetry(
          connection,
          workingDir,
          3,
          authMethod,
          autoAuthenticate,
        );
        modelInfo =
          extractModelInfoFromNewSessionResult(newSessionResult) || undefined;

        // Extract available models from session/new response
        const modelState = extractSessionModelState(newSessionResult);
        if (
          modelState?.availableModels &&
          modelState.availableModels.length > 0
        ) {
          availableModels = modelState.availableModels;
          console.log(
            '[MoliAgentManager] Extracted availableModels from session/new:',
            availableModels.map((m) => m.modelId),
          );
        }

        console.log('[MoliAgentManager] New session created successfully');
        sessionCreated = true;
      } catch (sessionError) {
        const needsAuth =
          autoAuthenticate === false &&
          isAuthenticationRequiredError(sessionError);
        if (needsAuth) {
          requiresAuth = true;
          console.log(
            '[MoliAgentManager] Session creation requires authentication; waiting for user-triggered login.',
          );
        } else {
          console.log(
            `\n⚠️ [SESSION FAILED] newSessionWithRetry threw error\n`,
          );
          console.log(`[MoliAgentManager] Error details:`, sessionError);
          throw sessionError;
        }
      }
    } else {
      sessionCreated = true;
    }

    console.log(`\n========================================`);
    console.log(`[MoliAgentManager] ✅ CONNECT() COMPLETED SUCCESSFULLY`);
    console.log(`========================================\n`);
    return { sessionCreated, requiresAuth, modelInfo, availableModels };
  }

  /**
   * Create new session (with retry)
   *
   * @param connection - ACP connection instance
   * @param workingDir - Working directory
   * @param maxRetries - Maximum number of retries
   */
  private async newSessionWithRetry(
    connection: AcpConnection,
    workingDir: string,
    maxRetries: number,
    authMethod: string,
    autoAuthenticate: boolean,
  ): Promise<unknown> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[MoliAgentManager] Creating session (attempt ${attempt}/${maxRetries})...`,
        );
        const res = await connection.newSession(workingDir);
        console.log('[MoliAgentManager] Session created successfully');
        return res;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[MoliAgentManager] Session creation attempt ${attempt} failed:`,
          errorMessage,
        );

        // If Qwen reports that authentication is required, try to
        // authenticate on-the-fly once and retry without waiting.
        const requiresAuth = isAuthenticationRequiredError(error);
        if (requiresAuth) {
          if (!autoAuthenticate) {
            console.log(
              '[MoliAgentManager] Authentication required but auto-authentication is disabled. Propagating error.',
            );
            throw error;
          }
          console.log(
            '[MoliAgentManager] Moli requires authentication. Authenticating and retrying session/new...',
          );
          try {
            await connection.authenticate(authMethod);
            // FIXME: @yiliang114 If there is no delay for a while, immediately executing
            // newSession may cause the cli authorization jump to be triggered again
            // Add a slight delay to ensure auth state is settled
            await new Promise((resolve) => setTimeout(resolve, 300));
            console.log(
              '[MoliAgentManager] newSessionWithRetry Authentication successful',
            );
            // Retry immediately after successful auth
            const res = await connection.newSession(workingDir);
            console.log(
              '[MoliAgentManager] Session created successfully after auth',
            );
            return res;
          } catch (authErr) {
            console.error(
              '[MoliAgentManager] Re-authentication failed:',
              authErr,
            );
            // Fall through to retry logic below
          }
        }

        if (attempt === maxRetries) {
          throw new Error(
            `Session creation failed after ${maxRetries} attempts: ${errorMessage}`,
          );
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[MoliAgentManager] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Session creation failed unexpectedly');
  }
}
