/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  Config,
} from '../index.js';
import {
  CoreToolScheduler,
  type AllToolCallsCompleteHandler,
  type OutputUpdateHandler,
  type ToolCallsUpdateHandler,
} from './coreToolScheduler.js';

export interface ExecuteToolCallOptions {
  outputUpdateHandler?: OutputUpdateHandler;
  onAllToolCallsComplete?: AllToolCallsCompleteHandler;
  onToolCallsUpdate?: ToolCallsUpdateHandler;
}

/**
 * Executes a batch of tool calls non-interactively with a single
 * CoreToolScheduler, so independent calls (read-only tools, task subagents)
 * can run in parallel. Responses are returned in request order.
 */
export async function executeToolCalls(
  config: Config,
  toolCallRequests: ToolCallRequestInfo[],
  abortSignal: AbortSignal,
  options: ExecuteToolCallOptions = {},
): Promise<ToolCallResponseInfo[]> {
  if (toolCallRequests.length === 0) {
    return [];
  }
  return new Promise<ToolCallResponseInfo[]>((resolve, reject) => {
    new CoreToolScheduler({
      config,
      chatRecordingService: config.getChatRecordingService(),
      outputUpdateHandler: options.outputUpdateHandler,
      onAllToolCallsComplete: async (completedToolCalls) => {
        if (options.onAllToolCallsComplete) {
          await options.onAllToolCallsComplete(completedToolCalls);
        }
        resolve(completedToolCalls.map((call) => call.response));
      },
      onToolCallsUpdate: options.onToolCallsUpdate,
      getPreferredEditor: () => undefined,
      onEditorClose: () => {},
    })
      .schedule(toolCallRequests, abortSignal)
      .catch(reject);
  });
}

/**
 * Executes a single tool call non-interactively by leveraging the CoreToolScheduler.
 */
export async function executeToolCall(
  config: Config,
  toolCallRequest: ToolCallRequestInfo,
  abortSignal: AbortSignal,
  options: ExecuteToolCallOptions = {},
): Promise<ToolCallResponseInfo> {
  const responses = await executeToolCalls(
    config,
    [toolCallRequest],
    abortSignal,
    options,
  );
  return responses[0];
}
