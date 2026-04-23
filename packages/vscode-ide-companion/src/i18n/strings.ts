/**
 * @license
 * Copyright 2025 Moli Team
 * SPDX-License-Identifier: Apache-2.0
 */

type SessionGroupLabel = 'Today' | 'Yesterday' | 'This Week' | 'Older';

export const UI_STRINGS = {
  appName: '몰리코드',
  panelTitle: '몰리코드',
  extensionDisplayName: 'Moli Code Companion',
  onboardingTitle: '몰리코드에 오신 것을 환영합니다',
  onboardingSubtitle:
    'VS Code 워크스페이스와 연결된 상태로 코드 탐색, 수정, diff 검토, 대화형 에이전트 작업을 한 흐름에서 이어갈 수 있습니다.',
  onboardingButton: '몰리코드 시작하기',
  emptyStateReady:
    '무엇을 하시겠습니까? 이 코드베이스에 대해 물어보거나 바로 코드 작업을 시작할 수 있습니다.',
  emptyStateCheckingLogin: '로그인 상태를 확인하는 중…',
  preparingApp: '몰리코드를 준비하는 중…',
  askPlaceholder: '몰리코드에게 물어보세요…',
  searchingFiles: '파일을 찾는 중…',
  searchingFilesHint: '입력해서 필터링하거나 잠시만 기다려 주세요…',
  switchModel: '모델 전환…',
  loginLabel: '로그인',
  loginDescription: '몰리코드에 로그인',
  loginLoading: '몰리코드에 로그인하는 중…',
  modelSelectorTitle: '모델 선택',
  modelSelectorEmpty: '사용 가능한 모델이 없습니다. 콘솔 로그를 확인해 주세요.',
  sessionSearchPlaceholder: '대화 검색…',
  sessionSearchAriaLabel: '대화 검색',
  noMatchingSessions: '일치하는 대화가 없습니다',
  noSessionsAvailable: '저장된 대화가 없습니다',
  sessionsLoading: '불러오는 중…',
  pastConversations: '지난 대화',
  pastConversationsTitle: '지난 대화 보기',
  newSessionTitle: '새 대화',
  newSessionAriaLabel: '새 대화',
  approvalPlanLabel: '계획 모드',
  approvalPlanTitle:
    '실행 전에 먼저 계획을 세웁니다. 클릭해서 모드를 바꿉니다.',
  approvalDefaultLabel: '수정 전 확인',
  approvalDefaultTitle:
    '파일을 수정하기 전에 매번 확인합니다. 클릭해서 모드를 바꿉니다.',
  approvalAutoLabel: '자동 편집',
  approvalAutoTitle:
    '파일 수정을 자동으로 진행합니다. 클릭해서 모드를 바꿉니다.',
  approvalYoloLabel: '자동 승인',
  approvalYoloTitle:
    '모든 도구 실행을 자동 승인합니다. 클릭해서 모드를 바꿉니다.',
  updatedVersionMessage: (latestVersion: string) =>
    `Moli Code Companion 확장의 새 버전(${latestVersion})을 사용할 수 있습니다.`,
  updateNow: '지금 업데이트',
  installedMessage: 'Moli Code Companion 확장이 설치되었습니다.',
  noFolderOpen:
    '폴더가 열려 있지 않습니다. 몰리코드를 실행할 폴더를 열어 주세요.',
  selectFolderToRun: '몰리코드를 실행할 폴더를 선택하세요',
  loginNeedsOpenChat: '로그인하려면 먼저 Moli Code 채팅 화면을 열어 주세요.',
  logChannelUnavailable: 'Moli Code Companion 로그 채널을 사용할 수 없습니다.',
  authNeedsAction: '몰리코드 인증이 필요합니다. 아래 작업을 선택해 주세요.',
  openInBrowser: '브라우저에서 열기',
  copyLink: '링크 복사',
  dismiss: '닫기',
  openingAuthPage: '브라우저에서 인증 페이지를 여는 중…',
  copiedAuthLink: '인증 링크를 클립보드에 복사했습니다.',
  connectingToMoli: '몰리코드에 연결하는 중입니다. 잠시만 기다려 주세요…',
  loginNow: '지금 로그인',
  loginToUseMoli: '몰리코드를 사용하려면 먼저 로그인해야 합니다.',
  loginBeforeNewSession: '새 대화를 만들기 전에 먼저 로그인해야 합니다.',
  loginExpiredForNewSession:
    '로그인 세션이 만료되었거나 유효하지 않습니다. 새 대화를 만들려면 다시 로그인해 주세요.',
  notLoggedInRestoreOrOffline:
    '로그인되어 있지 않습니다. 전체 세션 복원을 위해 지금 로그인하거나, 캐시된 내용을 오프라인으로 볼 수 있습니다.',
  viewOffline: '오프라인으로 보기',
  cachedSessionInfo:
    '캐시된 세션 내용을 표시하고 있습니다. AI와 상호작용하려면 로그인해 주세요.',
  loginExpiredForSwitchSession:
    '로그인 세션이 만료되었거나 유효하지 않습니다. 세션을 전환하려면 다시 로그인해 주세요.',
  sessionExpired: '세션이 만료되었습니다. 다시 로그인해 주세요.',
  sessionCacheWarning:
    '세션을 로컬 캐시에서 복원했습니다. 일부 문맥이 완전하지 않을 수 있습니다.',
  sessionCreateFailed: (errorMsg: string) =>
    `세션 생성에 실패했습니다: ${errorMsg}`,
  sessionSendFailed: (errorMsg: string) =>
    `메시지 전송 중 오류가 발생했습니다: ${errorMsg}`,
  requestTimedOut:
    '요청 시간이 초과되었습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
  attach: '첨부',
  attachContext: '문맥 첨부',
  currentFile: '현재 파일',
  chooseFileToAttach: '첨부할 파일 선택',
  searchWorkspaceFiles: '워크스페이스 파일 검색',
  failedShowDiff: (errorMsg: string) => `Diff 표시 실패: ${errorMsg}`,
} as const;

const SESSION_GROUP_LABELS: Record<SessionGroupLabel, string> = {
  Today: '오늘',
  Yesterday: '어제',
  'This Week': '이번 주',
  Older: '이전',
};

export function getSessionGroupLabel(label: string): string {
  return SESSION_GROUP_LABELS[label as SessionGroupLabel] ?? label;
}

export function formatSessionTimeAgo(timestamp: string): string {
  if (!timestamp) {
    return '';
  }

  const now = new Date().getTime();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return '방금';
  }
  if (diffMins < 60) {
    return `${diffMins}분 전`;
  }
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }
  if (diffDays === 1) {
    return '어제';
  }
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }
  return new Date(timestamp).toLocaleDateString('ko-KR');
}
