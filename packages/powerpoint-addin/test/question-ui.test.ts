// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { showQuestionDialog } from '../src/taskpane/question-ui.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ask_user_question dialog', () => {
  it('collects single, multi-select, and Other answers', () => {
    const onDecision = vi.fn();
    showQuestionDialog(
      [
        {
          question: 'Which style?',
          header: 'Style',
          options: [
            { label: 'Brief', description: 'Concise.' },
            { label: 'Detailed', description: 'More detail.' },
          ],
          multiSelect: false,
        },
        {
          question: 'Which sections?',
          header: 'Sections',
          options: [
            { label: 'Summary', description: 'Add summary.' },
            { label: 'Risks', description: 'Add risks.' },
          ],
          multiSelect: true,
        },
      ],
      onDecision,
    );

    const submit = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button'),
    ).find(
      (button) => button.textContent === '답변 보내기',
    ) as HTMLButtonElement;
    submit.click();
    expect(
      document.querySelector<HTMLElement>('.mc-question-error')?.style.display,
    ).toBe('');
    expect(onDecision).not.toHaveBeenCalled();

    const brief = document.querySelector<HTMLInputElement>(
      'input[value="Brief"]',
    );
    const summary = document.querySelector<HTMLInputElement>(
      'input[value="Summary"]',
    );
    const risks = document.querySelector<HTMLInputElement>(
      'input[value="Risks"]',
    );
    brief!.checked = true;
    summary!.checked = true;
    risks!.checked = true;
    submit.click();

    expect(onDecision).toHaveBeenCalledWith({
      behavior: 'answer',
      answers: { '0': 'Brief', '1': 'Summary, Risks' },
    });
    expect(document.querySelector('.mc-modal-overlay')).toBeNull();
  });

  it('selects Other when the user types custom text', () => {
    const onDecision = vi.fn();
    showQuestionDialog(
      [
        {
          question: 'Which style?',
          header: 'Style',
          options: [
            { label: 'Brief', description: 'Concise.' },
            { label: 'Detailed', description: 'More detail.' },
          ],
          multiSelect: false,
        },
      ],
      onDecision,
    );
    const other = document.querySelector<HTMLInputElement>(
      '.mc-question-other-input',
    ) as HTMLInputElement;
    other.value = 'Board-ready';
    other.dispatchEvent(new Event('input'));
    const submit = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button'),
    ).find(
      (button) => button.textContent === '답변 보내기',
    ) as HTMLButtonElement;
    submit.click();
    expect(onDecision).toHaveBeenCalledWith({
      behavior: 'answer',
      answers: { '0': 'Board-ready' },
    });
  });

  it('returns cancel without answers', () => {
    const onDecision = vi.fn();
    showQuestionDialog(
      [
        {
          question: 'Continue?',
          header: 'Continue',
          options: [
            { label: 'Yes', description: 'Continue.' },
            { label: 'No', description: 'Stop.' },
          ],
          multiSelect: false,
        },
      ],
      onDecision,
    );
    const cancel = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent === '취소') as HTMLButtonElement;
    cancel.click();
    expect(onDecision).toHaveBeenCalledWith({ behavior: 'cancel' });
  });
});
