/**
 * @license
 * Copyright 2025 Moli
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CommandContext,
  CommandKind,
  type SlashCommand,
  type MessageActionReturn,
  type SubmitPromptActionReturn,
} from './types.js';
import { t } from '../../i18n/index.js';

/**
 * /goal — sets a session-scoped goal the agent must accomplish before it is
 * allowed to stop. While a goal is active, every time the agent tries to end
 * its turn the core client evaluates goal completion and re-prompts the agent
 * to keep working until the goal is met (which clears it automatically).
 *
 *   /goal <text>   set (or replace) the session goal and start working
 *   /goal          show the current session goal
 *   /goal clear    clear the goal early
 */
export const goalCommand: SlashCommand = {
  name: 'goal',
  get description() {
    return t('Set a session goal the agent must accomplish before it can stop');
  },
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<MessageActionReturn | SubmitPromptActionReturn> => {
    const { config } = context.services;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Configuration is not available.'),
      };
    }

    const trimmedArgs = args.trim();

    if (!trimmedArgs) {
      const currentGoal = config.getSessionGoal();
      if (currentGoal) {
        return {
          type: 'message',
          messageType: 'info',
          content: t('Current session goal: {{goal}}', { goal: currentGoal }),
        };
      }
      return {
        type: 'message',
        messageType: 'info',
        content: t(
          'No session goal is set. Usage: /goal <goal text> to set one, /goal clear to clear.',
        ),
      };
    }

    if (trimmedArgs === 'clear') {
      if (!config.getSessionGoal()) {
        return {
          type: 'message',
          messageType: 'info',
          content: t('No session goal is set.'),
        };
      }
      config.setSessionGoal(undefined);
      return {
        type: 'message',
        messageType: 'info',
        content: t('Session goal cleared.'),
      };
    }

    config.setSessionGoal(trimmedArgs);
    return {
      type: 'submit_prompt',
      content: [
        {
          text:
            `<system-reminder>A session-scoped goal is now active: "${trimmedArgs}". ` +
            `Briefly acknowledge the goal, then immediately start (or continue) working toward it — ` +
            `treat the goal itself as your directive and do not pause to ask the user what to do. ` +
            `You will not be able to stop until the goal is met; it clears automatically once it holds. ` +
            `Do not tell the user to run "/goal clear" after success — that is only for abandoning a goal early.</system-reminder>`,
        },
      ],
    };
  },
};
