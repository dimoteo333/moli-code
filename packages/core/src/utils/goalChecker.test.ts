/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkGoalCompletion } from './goalChecker.js';
import type { GeminiChat } from '../core/geminiChat.js';
import type { Config } from '../config/config.js';

describe('checkGoalCompletion', () => {
  const abortSignal = new AbortController().signal;
  let generateJson: ReturnType<typeof vi.fn>;
  let config: Config;
  let chat: GeminiChat;

  beforeEach(() => {
    generateJson = vi.fn();
    config = {
      getBaseLlmClient: () => ({ generateJson }),
      getModel: () => 'test-model',
    } as unknown as Config;
    chat = {
      getHistory: vi.fn(() => [
        { role: 'user', parts: [{ text: 'do the thing' }] },
        { role: 'model', parts: [{ text: 'done.' }] },
      ]),
    } as unknown as GeminiChat;
  });

  it('returns the parsed judgement when the goal is met', async () => {
    generateJson.mockResolvedValue({
      reasoning: 'The task was completed and verified.',
      goal_met: true,
    });

    const result = await checkGoalCompletion(
      chat,
      config,
      abortSignal,
      'prompt-1',
      'do the thing',
    );

    expect(result).toEqual({
      reasoning: 'The task was completed and verified.',
      goal_met: true,
    });
    // The goal text must be part of the judge prompt.
    const contents = generateJson.mock.calls[0][0].contents;
    const lastText = contents[contents.length - 1].parts[0].text;
    expect(lastText).toContain('do the thing');
  });

  it('returns the parsed judgement when the goal is not met', async () => {
    generateJson.mockResolvedValue({
      reasoning: 'Only a plan was stated.',
      goal_met: false,
    });

    const result = await checkGoalCompletion(
      chat,
      config,
      abortSignal,
      'prompt-1',
      'do the thing',
    );

    expect(result?.goal_met).toBe(false);
  });

  it('returns null on empty history', async () => {
    (chat.getHistory as ReturnType<typeof vi.fn>).mockReturnValue([]);
    const result = await checkGoalCompletion(
      chat,
      config,
      abortSignal,
      'prompt-1',
      'goal',
    );
    expect(result).toBeNull();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('returns null when the judge response is malformed', async () => {
    generateJson.mockResolvedValue({ reasoning: 'no boolean here' });
    const result = await checkGoalCompletion(
      chat,
      config,
      abortSignal,
      'prompt-1',
      'goal',
    );
    expect(result).toBeNull();
  });

  it('returns null (fail open) when the judge call throws', async () => {
    generateJson.mockRejectedValue(new Error('endpoint unavailable'));
    const result = await checkGoalCompletion(
      chat,
      config,
      abortSignal,
      'prompt-1',
      'goal',
    );
    expect(result).toBeNull();
  });
});
