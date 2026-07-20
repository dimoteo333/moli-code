/** Dedicated modal/queue for the built-in ask_user_question tool. */

import type { QuestionSpec } from '../shared/messages.js';
import { STRINGS } from './strings.ko.js';

export interface QuestionRequest {
  id: string;
  questions: QuestionSpec[];
}

export interface QuestionDecision {
  behavior: 'answer' | 'cancel';
  answers?: { [index: string]: string };
}

export interface QuestionQueue {
  enqueue(request: QuestionRequest): void;
}

export function createQuestionQueue(
  respond: (id: string, decision: QuestionDecision) => void,
): QuestionQueue {
  const queue: QuestionRequest[] = [];
  let showing = false;

  function pump(): void {
    if (showing || queue.length === 0) return;
    showing = true;
    const request = queue.shift() as QuestionRequest;
    showQuestionDialog(request.questions, (decision) => {
      respond(request.id, decision);
      showing = false;
      pump();
    });
  }

  return {
    enqueue(request) {
      queue.push(request);
      pump();
    },
  };
}

interface QuestionControls {
  choices: HTMLInputElement[];
  otherChoice: HTMLInputElement;
  otherText: HTMLInputElement;
  multiSelect: boolean;
}

export function showQuestionDialog(
  questions: QuestionSpec[],
  onDecision: (decision: QuestionDecision) => void,
): void {
  const overlay = document.createElement('div');
  overlay.className = 'mc-modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'mc-modal mc-question-modal';
  overlay.appendChild(modal);

  const title = document.createElement('div');
  title.className = 'mc-modal-title';
  title.textContent = STRINGS.questionTitle;
  modal.appendChild(title);

  const controls: QuestionControls[] = [];
  for (let i = 0; i < questions.length; i++) {
    controls.push(renderQuestion(modal, questions[i], i));
  }

  const error = document.createElement('div');
  error.className = 'mc-question-error';
  error.style.display = 'none';
  modal.appendChild(error);

  const buttons = document.createElement('div');
  buttons.className = 'mc-question-buttons';
  modal.appendChild(buttons);

  let settled = false;
  function finish(decision: QuestionDecision): void {
    if (settled) return;
    settled = true;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    onDecision(decision);
  }

  const cancel = document.createElement('button');
  cancel.className = 'mc-modal-btn';
  cancel.textContent = STRINGS.questionCancel;
  cancel.onclick = function () {
    finish({ behavior: 'cancel' });
  };
  buttons.appendChild(cancel);

  const submit = document.createElement('button');
  submit.className = 'mc-modal-btn primary';
  submit.textContent = STRINGS.questionSubmit;
  submit.onclick = function () {
    const answers: { [index: string]: string } = {};
    for (let i = 0; i < controls.length; i++) {
      const answer = collectAnswer(controls[i]);
      if (!answer) {
        error.textContent = STRINGS.questionRequired;
        error.style.display = '';
        return;
      }
      answers[String(i)] = answer;
    }
    finish({ behavior: 'answer', answers });
  };
  buttons.appendChild(submit);

  document.body.appendChild(overlay);
}

function renderQuestion(
  modal: HTMLElement,
  question: QuestionSpec,
  index: number,
): QuestionControls {
  const section = document.createElement('div');
  section.className = 'mc-question-section';
  modal.appendChild(section);

  const header = document.createElement('div');
  header.className = 'mc-question-header';
  header.textContent = question.header;
  section.appendChild(header);

  const prompt = document.createElement('div');
  prompt.className = 'mc-question-prompt';
  prompt.textContent = question.question;
  section.appendChild(prompt);

  const choiceInputs: HTMLInputElement[] = [];
  const inputType = question.multiSelect ? 'checkbox' : 'radio';
  const groupName = 'mc-question-' + index;
  for (let i = 0; i < question.options.length; i++) {
    const choice = createChoice(
      section,
      inputType,
      groupName,
      question.options[i].label,
      question.options[i].description,
    );
    choiceInputs.push(choice);
  }

  const otherRow = document.createElement('label');
  otherRow.className = 'mc-question-choice mc-question-other';
  const otherChoice = document.createElement('input');
  otherChoice.type = inputType;
  otherChoice.name = groupName;
  otherChoice.value = '__other__';
  otherRow.appendChild(otherChoice);
  const otherLabel = document.createElement('span');
  otherLabel.className = 'mc-question-choice-label';
  otherLabel.textContent = STRINGS.questionOther;
  otherRow.appendChild(otherLabel);
  const otherText = document.createElement('input');
  otherText.type = 'text';
  otherText.maxLength = 2000;
  otherText.className = 'mc-question-other-input';
  otherText.setAttribute('placeholder', STRINGS.questionOtherPlaceholder);
  otherText.onfocus = function () {
    otherChoice.checked = true;
  };
  otherText.oninput = function () {
    if (otherText.value) otherChoice.checked = true;
  };
  otherRow.appendChild(otherText);
  section.appendChild(otherRow);

  return {
    choices: choiceInputs,
    otherChoice,
    otherText,
    multiSelect: question.multiSelect,
  };
}

function createChoice(
  parent: HTMLElement,
  type: string,
  name: string,
  labelText: string,
  description: string,
): HTMLInputElement {
  const row = document.createElement('label');
  row.className = 'mc-question-choice';
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.value = labelText;
  row.appendChild(input);
  const copy = document.createElement('span');
  copy.className = 'mc-question-choice-copy';
  const label = document.createElement('span');
  label.className = 'mc-question-choice-label';
  label.textContent = labelText;
  copy.appendChild(label);
  const detail = document.createElement('span');
  detail.className = 'mc-question-choice-description';
  detail.textContent = description;
  copy.appendChild(detail);
  row.appendChild(copy);
  parent.appendChild(row);
  return input;
}

function collectAnswer(controls: QuestionControls): string {
  const selected: string[] = [];
  for (let i = 0; i < controls.choices.length; i++) {
    if (controls.choices[i].checked) selected.push(controls.choices[i].value);
  }
  if (controls.otherChoice.checked) {
    const other = controls.otherText.value.replace(/^\s+|\s+$/g, '');
    if (other) selected.push(other);
  }
  return controls.multiSelect ? selected.join(', ') : selected[0] || '';
}
