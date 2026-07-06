/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content } from '@google/genai';
import { DEFAULT_MOLI_MODEL } from '../config/models.js';
import type { GeminiChat } from '../core/geminiChat.js';
import type { Config } from '../config/config.js';
import { createDebugLogger } from './debugLogger.js';

const debugLogger = createDebugLogger('GOAL_CHECKER');

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    reasoning: {
      type: 'string',
      description:
        'Brief explanation of whether the conversation shows the goal has been fully accomplished, citing concrete evidence from the conversation.',
    },
    goal_met: {
      type: 'boolean',
      description:
        'true only when the goal has been completely and verifiably accomplished in this session; false otherwise.',
    },
  },
  required: ['reasoning', 'goal_met'],
};

export interface GoalCheckResponse {
  reasoning: string;
  goal_met: boolean;
}

function buildCheckPrompt(goal: string): string {
  return `You are evaluating whether a session goal has been accomplished.

Session goal:
"""
${goal}
"""

Analyze the conversation so far and decide whether the goal has been **fully** accomplished.

Rules:
1. The goal counts as met only when the work it describes is actually done (implemented, fixed, answered, verified), not merely planned, described, or partially done.
2. Statements of intent ("I will...", "next I'll...") are evidence the goal is NOT yet met.
3. If errors, failing tests, or unresolved subtasks related to the goal remain, the goal is NOT met.
4. If the goal is genuinely impossible to make further progress on without user input, treat it as NOT met — the agent should say so and ask, but you must still report goal_met=false.

Respond with your reasoning and the boolean goal_met.`;
}

/**
 * Asks the model (as a side JSON call, mirroring nextSpeakerChecker) whether
 * the active session goal has been accomplished based on the conversation.
 * Returns null when no judgement could be made; callers should fail open
 * (allow stopping) in that case to avoid trapping the agent in a loop.
 */
export async function checkGoalCompletion(
  chat: GeminiChat,
  config: Config,
  abortSignal: AbortSignal,
  promptId: string,
  goal: string,
): Promise<GoalCheckResponse | null> {
  const curatedHistory = chat.getHistory(/* curated */ true);
  if (curatedHistory.length === 0) {
    return null;
  }

  const contents: Content[] = [
    ...curatedHistory,
    { role: 'user', parts: [{ text: buildCheckPrompt(goal) }] },
  ];

  try {
    const parsedResponse = (await config.getBaseLlmClient().generateJson({
      contents,
      schema: RESPONSE_SCHEMA,
      model: config.getModel() || DEFAULT_MOLI_MODEL,
      abortSignal,
      promptId,
    })) as unknown as GoalCheckResponse;

    if (parsedResponse && typeof parsedResponse.goal_met === 'boolean') {
      return parsedResponse;
    }
    return null;
  } catch (error) {
    debugLogger.warn('Failed to evaluate session goal completion.', error);
    return null;
  }
}
