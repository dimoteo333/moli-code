/** Korean UI strings for the task pane. */

export const STRINGS = {
  appTitle: '몰리 코드',
  appSubtitle: 'Excel용 AI 어시스턴트',
  statusConnecting: '연결 중...',
  statusConnected: '연결됨',
  statusDisconnected: '연결 끊김 — 재연결 중...',
  statusOfficeLoading: 'Office 초기화 중...',
  inputPlaceholder: '몰리에게 요청하세요. 예: "이 시트를 요약해줘"',
  send: '보내기',
  stop: '중지',
  working: '몰리가 작업 중입니다...',
  thinking: '몰리가 생각하고 있습니다...',
  secondsSuffix: '초',
  attachSelection: '선택 영역 첨부',
  attachTooLarge: '선택 영역이 너무 큽니다. 값 없이 주소만 첨부합니다.',
  attachFailed:
    '선택 영역을 읽을 수 없습니다. 워크북에서 범위를 선택해 주세요.',
  attachedRange: '선택 영역',
  removeAttachment: '첨부 제거',
  welcome:
    '안녕하세요! 몰리 코드입니다.\n현재 워크북을 읽고, 수정하고, 분석할 수 있습니다.\n무엇을 도와드릴까요?',
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
  errTokenFetch:
    '사이드카 서버에 연결할 수 없습니다. 몰리 사이드카가 실행 중인지 확인해 주세요.',
  errHello: '사이드카 인증에 실패했습니다. Excel을 다시 시작해 주세요.',
  excelToolNames: {
    excel_get_workbook_overview: '워크북 개요 읽기',
    excel_read_range: '범위 읽기',
    excel_write_range: '셀에 쓰기',
    excel_set_formulas: '수식 입력',
    excel_get_selection: '선택 영역 읽기',
    excel_clear_range: '범위 지우기',
    excel_add_worksheet: '워크시트 추가',
    excel_format_range: '서식 적용',
    excel_find: '찾기',
  } as { [name: string]: string },
};

/** Human label for a (possibly MCP-prefixed) tool name. */
export function toolLabel(toolName: string): string {
  const idx = toolName.lastIndexOf('__');
  const base = idx >= 0 ? toolName.slice(idx + 2) : toolName;
  return STRINGS.excelToolNames[base] || base;
}
