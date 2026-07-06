/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { goalCommand } from './goalCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('goalCommand', () => {
  let context: ReturnType<typeof createMockCommandContext>;
  let sessionGoal: string | undefined;
  let setSessionGoal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionGoal = undefined;
    setSessionGoal = vi.fn((goal: string | undefined) => {
      sessionGoal = goal;
    });
    context = createMockCommandContext({
      services: {
        config: {
          getSessionGoal: () => sessionGoal,
          setSessionGoal,
        },
      },
    });
  });

  it('reports when no goal is set', async () => {
    const result = await goalCommand.action!(context, '');
    expect(result).toMatchObject({
      type: 'message',
      messageType: 'info',
    });
    expect(setSessionGoal).not.toHaveBeenCalled();
  });

  it('shows the current goal', async () => {
    sessionGoal = 'CVS 연동 마무리';
    const result = await goalCommand.action!(context, '');
    expect(result).toMatchObject({ type: 'message', messageType: 'info' });
    expect((result as { content: string }).content).toContain(
      'CVS 연동 마무리',
    );
  });

  it('sets a goal and submits a kickoff prompt', async () => {
    const result = await goalCommand.action!(
      context,
      'Eclipse 플러그인 빌드 오류 수정',
    );
    expect(setSessionGoal).toHaveBeenCalledWith(
      'Eclipse 플러그인 빌드 오류 수정',
    );
    expect(result).toMatchObject({ type: 'submit_prompt' });
    const content = (result as { content: Array<{ text: string }> }).content;
    expect(content[0].text).toContain('Eclipse 플러그인 빌드 오류 수정');
    expect(content[0].text).toContain('session-scoped goal');
  });

  it('clears an active goal', async () => {
    sessionGoal = 'some goal';
    const result = await goalCommand.action!(context, 'clear');
    expect(setSessionGoal).toHaveBeenCalledWith(undefined);
    expect(result).toMatchObject({ type: 'message', messageType: 'info' });
  });

  it('reports clear on empty goal as a no-op', async () => {
    const result = await goalCommand.action!(context, 'clear');
    expect(setSessionGoal).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: 'message', messageType: 'info' });
  });

  it('errors when config is unavailable', async () => {
    const noConfig = createMockCommandContext({
      services: { config: null },
    });
    const result = await goalCommand.action!(noConfig, 'anything');
    expect(result).toMatchObject({ type: 'message', messageType: 'error' });
  });
});
