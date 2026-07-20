import { describe, expect, it, vi } from 'vitest';
import { InputFormat, ToolConfirmationOutcome } from '@dobby/moli-code-core';
import { PermissionController } from './permissionController.js';

describe('PermissionController ask_user_question bridge', () => {
  it('passes SDK answer payloads into the tool confirmation callback', async () => {
    const controller = new PermissionController(
      {
        config: { getInputFormat: () => InputFormat.STREAM_JSON },
        abortSignal: new AbortController().signal,
        inputClosed: false,
      } as never,
      {} as never,
      'PermissionController',
    );
    vi.spyOn(controller, 'sendControlRequest').mockResolvedValue({
      subtype: 'success',
      request_id: 'permission-1',
      response: {
        behavior: 'allow',
        answers: { '0': 'Brief', '1': 'Summary, Risks' },
      },
    });
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    controller.getToolCallUpdateCallback()([
      {
        status: 'awaiting_approval',
        request: {
          callId: 'ask-1',
          name: 'ask_user_question',
          args: { questions: [] },
        },
        confirmationDetails: {
          type: 'ask_user_question',
          title: 'Please answer',
          questions: [],
          onConfirm,
        },
      },
    ]);

    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        ToolConfirmationOutcome.ProceedOnce,
        { answers: { '0': 'Brief', '1': 'Summary, Risks' } },
      );
    });
  });
});
