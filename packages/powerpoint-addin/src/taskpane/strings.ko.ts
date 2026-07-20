export const STRINGS = {
  appTitle: '몰리 코드',
  appSubtitle: 'PowerPoint용 AI 어시스턴트',
  statusConnecting: '연결 중...',
  statusConnected: '연결됨',
  statusDisconnected: '연결 끊김 — 재연결 중...',
  inputPlaceholder:
    '몰리에게 요청하세요. 📌 버튼으로 문서를 첨부할 수 있습니다.',
  send: '보내기',
  stop: '중지',
  working: '몰리가 작업 중입니다...',
  thinking: '몰리가 생각하고 있습니다...',
  thinkingLive: '생각 중...',
  thinkingDone: '생각 과정',
  secondsSuffix: '초',
  attachFile: '로컬 텍스트 파일 첨부',
  removeAttachment: '첨부 제거',
  fileTooLarge: '파일이 너무 큽니다. 파일당 최대 256KB까지 첨부할 수 있습니다.',
  tooManyFiles: '파일은 한 메시지에 최대 5개까지 첨부할 수 있습니다.',
  totalTooLarge: '첨부 파일 내용은 합계 512KB까지 보낼 수 있습니다.',
  unsupportedFile:
    'Markdown, 텍스트, CSV, JSON, YAML 또는 소스 코드 파일을 선택해 주세요.',
  fileReadFailed: '선택한 파일을 읽을 수 없습니다.',
  questionTitle: '몰리의 질문',
  questionOther: '기타',
  questionOtherPlaceholder: '직접 입력',
  questionRequired: '각 질문에 답을 선택하거나 입력해 주세요.',
  questionSubmit: '답변 보내기',
  questionCancel: '취소',
  welcome:
    '안녕하세요! 몰리 코드입니다.\n📌 버튼으로 Markdown 같은 로컬 문서를 첨부한 뒤 @파일명으로 요청할 수 있습니다.\n무엇을 도와드릴까요?',
  permissionTitle: '작업 승인 요청',
  permissionBody: '몰리가 다음 작업을 실행하려고 합니다:',
  allow: '허용',
  alwaysAllow: '이 세션에서 항상 허용',
  deny: '거부',
  denyMessage: '사용자가 이 작업을 거부했습니다.',
  toolRunning: '실행 중',
  toolDone: '완료',
  toolFailed: '실패',
  turnError: '오류가 발생했습니다',
  errNoWebSocket:
    '이 환경에서는 WebSocket을 사용할 수 없습니다.\n그룹 정책(GPO)으로 IE의 WebSocket이 비활성화되어 있을 수 있습니다. IT 관리자에게 문의해 주세요.',
  errHello: '사이드카 인증에 실패했습니다. PowerPoint를 다시 시작해 주세요.',
};

export function toolLabel(toolName: string): string {
  const idx = toolName.lastIndexOf('__');
  return idx >= 0 ? toolName.slice(idx + 2) : toolName;
}
