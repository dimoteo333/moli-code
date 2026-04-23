/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Loading messages from Moli Code CLI
 * Source: packages/cli/src/ui/hooks/usePhraseCycler.ts
 */
export const WITTY_LOADING_PHRASES = [
  '요청을 정리하는 중…',
  '코드 문맥을 읽는 중…',
  '적절한 응답을 준비하는 중…',
  '변경사항을 검토하는 중…',
  '파일 구조를 확인하는 중…',
  '답변을 구성하는 중…',
  '필요한 정보를 모으는 중…',
  '도구 결과를 정리하는 중…',
  '조금만 기다려 주세요…',
  '거의 다 됐습니다…',
];

export const getRandomLoadingMessage = (): string =>
  WITTY_LOADING_PHRASES[
    Math.floor(Math.random() * WITTY_LOADING_PHRASES.length)
  ];
