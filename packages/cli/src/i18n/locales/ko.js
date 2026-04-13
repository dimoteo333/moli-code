/**
 * @license
 * Copyright 2026 dobby
 * SPDX-License-Identifier: Apache-2.0
 */

// Korean translations for Moli Code CLI
// English key serves as translation key, value is Korean translation

export default {
  // ============================================================================
  // Help / UI Components
  // ============================================================================
  // Attachment hints
  '↑ to manage attachments': '↑ 첨부 파일 관리',
  '← → select, Delete to remove, ↓ to exit':
    '← → 선택, Delete로 제거, ↓로 종료',
  'Attachments: ': '첨부 파일: ',

  'Basics:': '기본 사항:',
  'Add context': '컨텍스트 추가',
  'Use {{symbol}} to specify files for context (e.g., {{example}}) to target specific files or folders.':
    '{{symbol}}을(를) 사용해 컨텍스트에 파일을 지정하세요 (예: {{example}}).',
  '@': '@',
  '@src/myFile.ts': '@src/myFile.ts',
  'Shell mode': '셸 모드',
  'YOLO mode': 'YOLO 모드',
  'plan mode': '계획 모드',
  'auto-accept edits': '편집 자동 승인',
  'Accepting edits': '편집 승인 중',
  '(shift + tab to cycle)': '(Shift + Tab으로 전환)',
  '(tab to cycle)': '(Tab으로 전환)',
  'Execute shell commands via {{symbol}} (e.g., {{example1}}) or use natural language (e.g., {{example2}}).':
    '{{symbol}}을(를) 통해 셸 명령을 실행하거나(예: {{example1}}) 자연어를 사용하세요(예: {{example2}}).',
  '!': '!',
  '!npm run start': '!npm run start',
  'start server': '서버 시작',
  'Commands:': '명령어:',
  'shell command': '셸 명령',
  'Model Context Protocol command (from external servers)':
    'Model Context Protocol 명령 (외부 서버에서)',
  'Keyboard Shortcuts:': '키보드 단축키:',
  'Toggle this help display': '이 도움말 표시 전환',
  'Toggle shell mode': '셸 모드 전환',
  'Open command menu': '명령 메뉴 열기',
  'Add file context': '파일 컨텍스트 추가',
  'Accept suggestion / Autocomplete': '제안 수락 / 자동 완성',
  'Reverse search history': '기록 역방향 검색',
  'Press ? again to close': '다시 ?를 눌러 닫기',
  // Keyboard shortcuts panel descriptions
  'for shell mode': '셸 모드용',
  'for commands': '명령어용',
  'for file paths': '파일 경로용',
  'to clear input': '입력 지우기',
  'to cycle approvals': '승인 모드 전환',
  'to quit': '종료',
  'for newline': '줄 바꿈',
  'to clear screen': '화면 지우기',
  'to search history': '기록 검색',
  'to paste images': '이미지 붙여넣기',
  'for external editor': '외부 편집기용',
  'Jump through words in the input': '입력창에서 단어 간 이동',
  'Close dialogs, cancel requests, or quit application':
    '대화상자 닫기, 요청 취소 또는 애플리케이션 종료',
  'New line': '새 줄',
  'New line (Alt+Enter works for certain linux distros)':
    '새 줄 (특정 리눅스 배포판에서는 Alt+Enter 작동)',
  'Clear the screen': '화면 지우기',
  'Open input in external editor': '외부 편집기에서 입력 열기',
  'Send message': '메시지 보내기',
  'Initializing...': '초기화 중...',
  'Connecting to MCP servers... ({{connected}}/{{total}})':
    'MCP 서버에 연결 중... ({{connected}}/{{total}})',
  'Type your message or @path/to/file': '메시지 또는 @path/to/file 입력',
  '? for shortcuts': '? 단축키 보기',
  "Press 'i' for INSERT mode and 'Esc' for NORMAL mode.":
    "'i'를 누르면 INSERT 모드, 'Esc'를 누르면 NORMAL 모드.",
  'Cancel operation / Clear input (double press)':
    '작업 취소 / 입력 지우기 (두 번 누르기)',
  'Cycle approval modes': '승인 모드 전환',
  'Cycle through your prompt history': '프롬프트 기록 탐색',
  'For a full list of shortcuts, see {{docPath}}':
    '전체 단축키 목록은 {{docPath}}를 참조하세요',
  'docs/keyboard-shortcuts.md': 'docs/keyboard-shortcuts.md',
  'for help on Moli Code': '몰리코드 도움말',
  'show version info': '버전 정보 표시',
  'submit a bug report': '버그 보고서 제출',
  'About Moli Code': '몰리코드 정보',
  Status: '상태',

  // ============================================================================
  // System Information Fields
  // ============================================================================
  'Moli Code': '몰리코드',
  Runtime: '런타임',
  OS: 'OS',
  Auth: '인증',
  'CLI Version': 'CLI 버전',
  'Git Commit': 'Git 커밋',
  Model: '모델',
  Sandbox: '샌드박스',
  'OS Platform': 'OS 플랫폼',
  'OS Arch': 'OS 아키텍처',
  'OS Release': 'OS 릴리스',
  'Node.js Version': 'Node.js 버전',
  'NPM Version': 'NPM 버전',
  'Session ID': '세션 ID',
  'Auth Method': '인증 방법',
  'Base URL': '기본 URL',
  Proxy: '프록시',
  'Memory Usage': '메모리 사용량',
  'IDE Client': 'IDE 클라이언트',

  // ============================================================================
  // Commands - General
  // ============================================================================
  'Analyzes the project and creates a tailored MOLI.md file.':
    '프로젝트를 분석하고 맞춤형 MOLI.md 파일을 생성해요.',
  'Analyzes the project and creates a tailored QWEN.md file.':
    '프로젝트를 분석하고 맞춤형 MOLI.md 파일을 생성해요.',
  'list available Moli Code tools. Usage: /tools [desc]':
    '사용 가능한 몰리코드 도구를 보여드려요. 사용법: /tools [desc]',
  'List available Moli Code tools. Usage: /tools [desc]':
    '사용 가능한 몰리코드 도구를 보여드려요. 사용법: /tools [desc]',
  'List available skills.': '사용 가능한 스킬을 보여드려요.',
  'Available Moli Code CLI tools:': '사용 가능한 몰리코드 CLI 도구:',
  'No tools available': '사용 가능한 도구 없음',
  'View or change the approval mode for tool usage':
    '도구 사용 승인 모드 보기 또는 변경',
  'Invalid approval mode "{{arg}}". Valid modes: {{modes}}':
    '잘못된 승인 모드 "{{arg}}". 유효한 모드: {{modes}}',
  'Approval mode set to "{{mode}}"': '승인 모드가 "{{mode}}"(으)로 설정됨',
  'View or change the language setting': '언어 설정 보기 또는 변경',
  'change the theme': '테마 변경',
  'Select Theme': '테마 선택',
  Preview: '미리보기',
  '(Use Enter to select, Tab to configure scope)':
    '(Enter로 선택, Tab으로 범위 설정)',
  '(Use Enter to apply scope, Tab to go back)':
    '(Enter로 범위 적용, Tab으로 뒤로 가기)',
  'Theme configuration unavailable due to NO_COLOR env variable.':
    'NO_COLOR 환경 변수로 인해 테마 구성을 사용할 수 없어요.',
  'Theme "{{themeName}}" not found.':
    '테마 "{{themeName}}"을(를) 찾을 수 없어요.',
  'Theme "{{themeName}}" not found in selected scope.':
    '선택된 범위에서 테마 "{{themeName}}"을(를) 찾을 수 없어요.',
  'Clear conversation history and free up context':
    '대화 기록을 지우고 컨텍스트 확보',
  'Compresses the context by replacing it with a summary.':
    '요약으로 컨텍스트를 대체하여 압축해요.',
  'open full Moli Code documentation in your browser':
    '브라우저에서 전체 Moli Code 문서 열기',
  'Configuration not available.': '구성을 사용할 수 없어요.',
  'change the auth method': '인증 방법 변경',
  'Configure authentication information for login':
    '로그인을 위한 인증 정보 구성',
  'Copy the last result or code snippet to clipboard':
    '마지막 결과 또는 코드 조각을 클립보드에 복사',

  // ============================================================================
  // Commands - Agents
  // ============================================================================
  'Manage subagents for specialized task delegation.':
    '전문 작업 위임을 위한 서브에이전트를 관리해요.',
  'Manage existing subagents (view, edit, delete).':
    '기존 서브에이전트 관리 (보기, 편집, 삭제).',
  'Create a new subagent with guided setup.':
    '가이드 설정으로 새 서브에이전트를 만듭니다.',

  // ============================================================================
  // Agents - Management Dialog
  // ============================================================================
  Agents: '에이전트',
  'Choose Action': '작업 선택',
  'Edit {{name}}': '{{name}} 편집',
  'Edit Tools: {{name}}': '도구 편집: {{name}}',
  'Edit Color: {{name}}': '색상 편집: {{name}}',
  'Delete {{name}}': '{{name}} 삭제',
  'Unknown Step': '알 수 없는 단계',
  'Esc to close': 'Esc로 닫기',
  'Enter to select, ↑↓ to navigate, Esc to close':
    'Enter로 선택, ↑↓로 이동, Esc로 닫기',
  'Esc to go back': 'Esc로 뒤로 가기',
  'Enter to confirm, Esc to cancel': 'Enter로 확인, Esc로 취소',
  'Enter to submit, Esc to go back': 'Enter로 제출, Esc로 뒤로 가기',
  'Invalid step: {{step}}': '잘못된 단계: {{step}}',
  'No subagents found.': '서브에이전트를 찾을 수 없어요.',
  "Use '/agents create' to create your first subagent.":
    "'/agents create'를 사용하여 첫 번째 서브에이전트를 만드세요.",
  '(built-in)': '(내장)',
  '(overridden by project level agent)': '(프로젝트 수준 에이전트로 재정의됨)',
  'Project Level ({{path}})': '프로젝트 수준 ({{path}})',
  'User Level ({{path}})': '사용자 수준 ({{path}})',
  'Built-in Agents': '내장 에이전트',
  'Extension Agents': '확장 에이전트',
  'Using: {{count}} agents': '{{count}}개 에이전트 사용 중',
  'View Agent': '에이전트 보기',
  'Edit Agent': '에이전트 편집',
  'Delete Agent': '에이전트 삭제',
  Back: '뒤로',
  'No agent selected': '선택된 에이전트 없음',
  'File Path: ': '파일 경로: ',
  'Tools: ': '도구: ',
  'Color: ': '색상: ',
  'Description:': '설명:',
  'System Prompt:': '시스템 프롬프트:',
  'Open in editor': '편집기에서 열기',
  'Edit tools': '도구 편집',
  'Edit color': '색상 편집',
  '❌ Error:': '❌ 오류:',
  'Are you sure you want to delete agent "{{name}}"?':
    '에이전트 "{{name}}"을(를) 삭제하시겠습니까?',
  // ============================================================================
  // Agents - Creation Wizard
  // ============================================================================
  'Project Level (.moli/agents/)': '프로젝트 수준 (.moli/agents/)',
  'Project Level (.qwen/agents/)': '프로젝트 수준 (.moli/agents/)',
  'User Level (~/.moli/agents/)': '사용자 수준 (~/.moli/agents/)',
  'User Level (~/.qwen/agents/)': '사용자 수준 (~/.moli/agents/)',
  '✅ Subagent Created Successfully!':
    '✅ 서브에이전트가 성공적으로 생성되었어요!',
  'Subagent "{{name}}" has been saved to {{level}} level.':
    '서브에이전트 "{{name}}"이(가) {{level}} 수준에 저장되었어요.',
  'Name: ': '이름: ',
  'Location: ': '위치: ',
  '❌ Error saving subagent:': '❌ 서브에이전트 저장 오류:',
  'Warnings:': '경고:',
  'Name "{{name}}" already exists at {{level}} level - will overwrite existing subagent':
    '이름 "{{name}}"이(가) {{level}} 수준에 이미 존재함 - 기존 서브에이전트를 덮어씀',
  'Name "{{name}}" exists at user level - project level will take precedence':
    '이름 "{{name}}"이(가) 사용자 수준에 존재함 - 프로젝트 수준이 우선 적용됨',
  'Name "{{name}}" exists at project level - existing subagent will take precedence':
    '이름 "{{name}}"이(가) 프로젝트 수준에 존재함 - 기존 서브에이전트가 우선 적용됨',
  'Description is over {{length}} characters': '설명이 {{length}}자를 초과함',
  'System prompt is over {{length}} characters':
    '시스템 프롬프트가 {{length}}자를 초과함',
  // Agents - Creation Wizard Steps
  'Step {{n}}: Choose Location': '단계 {{n}}: 위치 선택',
  'Step {{n}}: Choose Generation Method': '단계 {{n}}: 생성 방법 선택',
  'Generate with Moli Code (Recommended)': '몰리코드로 생성 (권장)',
  'Manual Creation': '수동 생성',
  'Describe what this subagent should do and when it should be used. (Be comprehensive for best results)':
    '이 서브 에이전트가 무엇을 해야 하는지 언제 사용되어야 하는지 설명하세요. (최상의 결과를 위해 포괄적으로 작성)',
  'e.g., Expert code reviewer that reviews code based on best practices...':
    '예: 모범 사례에 따라 코드를 검토하는 전문 코드 검토자...',
  'Generating subagent configuration...': '서브에이전트 구성 생성 중...',
  'Failed to generate subagent: {{error}}': '서브에이전트 생성 실패: {{error}}',
  'Step {{n}}: Describe Your Subagent': '단계 {{n}}: 서브에이전트 설명',
  'Step {{n}}: Enter Subagent Name': '단계 {{n}}: 서브에이전트 이름 입력',
  'Step {{n}}: Enter System Prompt': '단계 {{n}}: 시스템 프롬프트 입력',
  'Step {{n}}: Enter Description': '단계 {{n}}: 설명 입력',
  // Agents - Tool Selection
  'Step {{n}}: Select Tools': '단계 {{n}}: 도구 선택',
  'All Tools (Default)': '모든 도구 (기본값)',
  'All Tools': '모든 도구',
  'Read-only Tools': '읽기 전용 도구',
  'Read & Edit Tools': '읽기 및 편집 도구',
  'Read & Edit & Execution Tools': '읽기 및 편집 및 실행 도구',
  'All tools selected, including MCP tools':
    'MCP 도구를 포함한 모든 도구가 선택됨',
  'Selected tools:': '선택된 도구:',
  'Read-only tools:': '읽기 전용 도구:',
  'Edit tools:': '편집 도구:',
  'Execution tools:': '실행 도구:',
  'Step {{n}}: Choose Background Color': '단계 {{n}}: 배경색 선택',
  'Step {{n}}: Confirm and Save': '단계 {{n}}: 확인 및 저장',
  // Agents - Navigation & Instructions
  'Esc to cancel': 'Esc로 취소',
  'Press Enter to save, e to save and edit, Esc to go back':
    'Enter로 저장, e로 저장 후 편집, Esc로 뒤로 가기',
  'Press Enter to continue, {{navigation}}Esc to {{action}}':
    'Enter로 계속, {{navigation}}Esc로 {{action}}',
  cancel: '취소',
  'go back': '뒤로 가기',
  '↑↓ to navigate, ': '↑↓로 이동, ',
  'Enter a clear, unique name for this subagent.':
    '이 서브에이전트의 명확하고 고유한 이름을 입력하세요.',
  'e.g., Code Reviewer': '예: 코드 검토자',
  'Name cannot be empty.': '이름은 비어있을 수 없어요.',
  "Write the system prompt that defines this subagent's behavior. Be comprehensive for best results.":
    '이 서브에이전트의 동작을 정의하는 시스템 프롬프트를 작성하세요. 최상의 결과를 위해 포괄적으로 작성하세요.',
  'e.g., You are an expert code reviewer...':
    '예: 당신은 전문 코드 검토자입니다...',
  'System prompt cannot be empty.': '시스템 프롬프트는 비어있을 수 없어요.',
  'Describe when and how this subagent should be used.':
    '이 서브에이전트가 언제 어떻게 사용되어야 하는지 설명하세요.',
  'e.g., Reviews code for best practices and potential bugs.':
    '예: 모범 사례와 잠재적 버그에 대해 코드를 검토해요.',
  'Description cannot be empty.': '설명은 비어있을 수 없어요.',
  'Failed to launch editor: {{error}}': '편집기 시작 실패: {{error}}',
  'Failed to save and edit subagent: {{error}}':
    '서브에이전트 저장 및 편집 실패: {{error}}',

  // ============================================================================
  // Extensions - Management Dialog
  // ============================================================================
  'Manage Extensions': '확장 관리',
  'Extension Details': '확장 상세 정보',
  'View Extension': '확장 보기',
  'Update Extension': '확장 업데이트',
  'Disable Extension': '확장 비활성화',
  'Enable Extension': '확장 활성화',
  'Uninstall Extension': '확장 제거',
  'Select Scope': '범위 선택',
  'User Scope': '사용자 범위',
  'Workspace Scope': '작업 공간 범위',
  'No extensions found.': '확장을 찾을 수 없어요.',
  Active: '활성',
  Disabled: '비활성화됨',
  'Update available': '업데이트 사용 가능',
  'Up to date': '최신 상태',
  'Checking...': '확인 중...',
  'Updating...': '업데이트 중...',
  Unknown: '알 수 없음',
  Error: '오류',
  'Version:': '버전:',
  'Status:': '상태:',
  'Are you sure you want to uninstall extension "{{name}}"?':
    '확장 "{{name}}"을(를) 제거하시겠습니까?',
  'This action cannot be undone.': '이 작업은 되돌릴 수 없어요.',
  'Extension "{{name}}" disabled successfully.':
    '확장 "{{name}}"이(가) 성공적으로 비활성화되었어요.',
  'Extension "{{name}}" enabled successfully.':
    '확장 "{{name}}"이(가) 성공적으로 활성화되었어요.',
  'Extension "{{name}}" updated successfully.':
    '확장 "{{name}}"이(가) 성공적으로 업데이트되었어요.',
  'Failed to update extension "{{name}}": {{error}}':
    '확장 "{{name}}" 업데이트 실패: {{error}}',
  'Select the scope for this action:': '이 작업의 범위를 선택하세요:',
  'User - Applies to all projects': '사용자 - 모든 프로젝트에 적용',
  'Workspace - Applies to current project only':
    '작업 공간 - 현재 프로젝트에만 적용',
  // Extension dialog - missing keys
  'Name:': '이름:',
  'MCP Servers:': 'MCP 서버:',
  'Settings:': '설정:',
  active: '활성',
  disabled: '비활성화됨',
  'View Details': '상세 보기',
  'Update failed:': '업데이트 실패:',
  'Updating {{name}}...': '{{name}} 업데이트 중...',
  'Update complete!': '업데이트 완료!',
  'User (global)': '사용자 (전역)',
  'Workspace (project-specific)': '작업 공간 (프로젝트별)',
  'Disable "{{name}}" - Select Scope': '"{{name}}" 비활성화 - 범위 선택',
  'Enable "{{name}}" - Select Scope': '"{{name}}" 활성화 - 범위 선택',
  'No extension selected': '선택된 확장 없음',
  'Press Y/Enter to confirm, N/Esc to cancel': 'Y/Enter로 확인, N/Esc로 취소',
  'Y/Enter to confirm, N/Esc to cancel': 'Y/Enter로 확인, N/Esc로 취소',
  '{{count}} extensions installed': '{{count}}개 확장 설치됨',
  "Use '/extensions install' to install your first extension.":
    "'/extensions install'을(를) 사용하여 첫 번째 확장을 설치하세요.",
  // Update status values
  'up to date': '최신 상태',
  'update available': '업데이트 사용 가능',
  'checking...': '확인 중...',
  'not updatable': '업데이트 불가',
  error: '오류',

  // ============================================================================
  // Commands - General (continued)
  // ============================================================================
  'View and edit Moli Code settings': 'Moli Code 설정 보기 및 편집',
  Settings: '설정',
  'To see changes, Moli Code must be restarted. Press r to exit and apply changes now.':
    '변경사항을 적용하려면 Moli Code를 다시 시작해야 해요. r을 눌러 종료하고 변경사항을 지금 적용하세요.',
  'The command "/{{command}}" is not supported in non-interactive mode.':
    '명령어 "/{{command}}"은(는) 대화형 모드가 아닌 경우 지원되지 않아요.',
  // ============================================================================
  // Settings Labels
  // ============================================================================
  'Vim Mode': 'Vim 모드',
  'Disable Auto Update': '자동 업데이트 비활성화',
  'Attribution: commit': '속성: 커밋',
  'Terminal Bell Notification': '터미널 벨 알림',
  'Enable Usage Statistics': '사용 통계 활성화',
  Theme: '테마',
  'Preferred Editor': '선호하는 편집기',
  'Auto-connect to IDE': 'IDE에 자동 연결',
  'Enable Prompt Completion': '프롬프트 자동 완성 활성화',
  'Debug Keystroke Logging': '키 입력 로깅 디버그',
  'Language: UI': '언어: UI',
  'Language: Model': '언어: 모델',
  'Output Format': '출력 형식',
  'Hide Window Title': '창 제목 숨기기',
  'Show Status in Title': '제목에 상태 표시',
  'Hide Tips': '팁 숨기기',
  'Show Line Numbers in Code': '코드에 줄 번호 표시',
  'Show Citations': '인용 표시',
  'Custom Witty Phrases': '사용자 지정 재치 있는 문구',
  'Show Welcome Back Dialog': '환영 복귀 대화상자 표시',
  'Enable User Feedback': '사용자 피드백 활성화',
  'How is Moli doing this session? (optional)':
    '이번 세션에서 몰리는 어떤가요? (선택 사항)',
  Bad: '나쁨',
  Fine: '보통',
  Good: '좋음',
  Dismiss: '닫기',
  'Not Sure Yet': '아직 잘 모르겠음',
  'Any other key': '기타 키',
  'Disable Loading Phrases': '로딩 문구 비활성화',
  'Screen Reader Mode': '스크린 리더 모드',
  'IDE Mode': 'IDE 모드',
  'Max Session Turns': '최대 세션 턴',
  'Skip Next Speaker Check': '다음 발언자 확인 건너뛰기',
  'Skip Loop Detection': '루프 감지 건너뛰기',
  'Skip Startup Context': '시작 컨텍스트 건너뛰기',
  'Enable OpenAI Logging': 'OpenAI 로깅 활성화',
  'OpenAI Logging Directory': 'OpenAI 로깅 디렉터리',
  Timeout: '시간 초과',
  'Max Retries': '최대 재시도',
  'Disable Cache Control': '캐시 제어 비활성화',
  'Memory Discovery Max Dirs': '메모리 발견 최대 디렉터리',
  'Load Memory From Include Directories': '포함 디렉터리에서 메모리 로드',
  'Respect .gitignore': '.gitignore 준수',
  'Respect .moliignore': '.moliignore 준수',
  'Respect .qwenignore': '.moliignore 준수',
  'Enable Recursive File Search': '재귀적 파일 검색 활성화',
  'Disable Fuzzy Search': '퍼지 검색 비활성화',
  'Interactive Shell (PTY)': '대화형 셸 (PTY)',
  'Show Color': '색상 표시',
  'Auto Accept': '자동 승인',
  'Use Ripgrep': 'Ripgrep 사용',
  'Use Builtin Ripgrep': '내장 Ripgrep 사용',
  'Enable Tool Output Truncation': '도구 출력 자르기 활성화',
  'Tool Output Truncation Threshold': '도구 출력 자르기 임계값',
  'Tool Output Truncation Lines': '도구 출력 자르기 줄',
  'Folder Trust': '폴더 신뢰',
  'Vision Model Preview': '비전 모델 미리보기',
  'Tool Schema Compliance': '도구 스키마 준수',
  // Settings enum options
  'Auto (detect from system)': '자동 (시스템에서 감지)',
  Text: '텍스트',
  JSON: 'JSON',
  Plan: '계획',
  Default: '기본값',
  'Auto Edit': '자동 편집',
  YOLO: 'YOLO',
  'toggle vim mode on/off': 'vim 모드 켜기/끄기',
  'check session stats. Usage: /stats [model|tools]':
    '세션 통계 확인. 사용법: /stats [model|tools]',
  'Show model-specific usage statistics.': '모델별 사용 통계 표시.',
  'Show tool-specific usage statistics.': '도구별 사용 통계 표시.',
  'exit the cli': 'CLI 종료',
  'list configured MCP servers and tools, or authenticate with OAuth-enabled servers':
    '구성된 MCP 서버 및 도구 나열 또는 OAuth 지원 서버에 인증',
  'Open MCP management dialog, or authenticate with OAuth-enabled servers':
    'MCP 관리 대화상자 열기 또는 OAuth 지원 서버에 인증',
  'List configured MCP servers and tools, or authenticate with OAuth-enabled servers':
    '구성된 MCP 서버 및 도구 나열 또는 OAuth 지원 서버에 인증',
  'Manage workspace directories': '작업 공간 디렉터리 관리',
  'Add directories to the workspace. Use comma to separate multiple paths':
    '작업 공간에 디렉터리를 추가해요. 여러 경로는 쉼표로 구분하세요',
  'Show all directories in the workspace': '작업 공간의 모든 디렉터리 표시',
  'set external editor preference': '외부 편집기 기본 설정',
  'Select Editor': '편집기 선택',
  'Editor Preference': '편집기 기본 설정',
  'These editors are currently supported. Please note that some editors cannot be used in sandbox mode.':
    '현재 이 편집기들이 지원돼요. 일부 편집기는 샌드박스 모드에서 사용할 수 없어요.',
  'Your preferred editor is:': '선호하는 편집기:',
  'Manage extensions': '확장 관리',
  'Manage installed extensions': '설치된 확장 관리',
  'List active extensions': '활성 확장 나열',
  'Update extensions. Usage: update <extension-names>|--all':
    '확장 업데이트. 사용법: update <extension-names>|--all',
  'Disable an extension': '확장 비활성화',
  'Enable an extension': '확장 활성화',
  'Install an extension from a git repo or local path':
    'git 저장소 또는 로컬 경로에서 확장 설치',
  'Uninstall an extension': '확장 제거',
  'No extensions installed.': '설치된 확장이 없어요.',
  'Usage: /extensions update <extension-names>|--all':
    '사용법: /extensions update <extension-names>|--all',
  'Extension "{{name}}" not found.': '확장 "{{name}}"을(를) 찾을 수 없어요.',
  'No extensions to update.': '업데이트할 확장이 없어요.',
  'Usage: /extensions install <source>': '사용법: /extensions install <source>',
  'Installing extension from "{{source}}"...':
    '"{{source}}"에서 확장 설치 중...',
  'Extension "{{name}}" installed successfully.':
    '확장 "{{name}}"이(가) 성공적으로 설치되었어요.',
  'Failed to install extension from "{{source}}": {{error}}':
    '"{{source}}"에서 확장 설치 실패: {{error}}',
  'Usage: /extensions uninstall <extension-name>':
    '사용법: /extensions uninstall <extension-name>',
  'Uninstalling extension "{{name}}"...': '확장 "{{name}}" 제거 중...',
  'Extension "{{name}}" uninstalled successfully.':
    '확장 "{{name}}"이(가) 성공적으로 제거되었어요.',
  'Failed to uninstall extension "{{name}}": {{error}}':
    '확장 "{{name}}" 제거 실패: {{error}}',
  'Usage: /extensions {{command}} <extension> [--scope=<user|workspace>]':
    '사용법: /extensions {{command}} <extension> [--scope=<user|workspace>]',
  'Unsupported scope "{{scope}}", should be one of "user" or "workspace"':
    '지원되지 않는 범위 "{{scope}}", "user" 또는 "workspace" 중 하나여야 해요',
  'Extension "{{name}}" disabled for scope "{{scope}}"':
    '범위 "{{scope}}"에 대해 확장 "{{name}}"이(가) 비활성화됨',
  'Extension "{{name}}" enabled for scope "{{scope}}"':
    '범위 "{{scope}}"에 대해 확장 "{{name}}"이(가) 활성화됨',
  'Do you want to continue? [Y/n]: ': '계속하시겠습니까? [Y/n]: ',
  'Do you want to continue?': '계속하시겠습니까?',
  'Installing extension "{{name}}".':
    '확장 "{{name}}"을(를) 설치하는 중입니다.',
  '**Extensions may introduce unexpected behavior. Ensure you have investigated the extension source and trust the author.**':
    '**확장으로 인해 예기치 않은 동작이 발생할 수 있어요. 확장 출처를 조사하고 작성자를 신뢰하는지 확인하세요.**',
  'This extension will run the following MCP servers:':
    '이 확장은 다음 MCP 서버를 실행해요:',
  local: '로컬',
  remote: '원격',
  'This extension will add the following commands: {{commands}}.':
    '이 확장은 다음 명령을 추가해요: {{commands}}.',
  'This extension will append info to your MOLI.md context using {{fileName}}':
    '이 확장은 {{fileName}}을(를) 사용해 MOLI.md 컨텍스트에 정보를 추가해요',
  'This extension will append info to your QWEN.md context using {{fileName}}':
    '이 확장은 {{fileName}}을(를) 사용해 MOLI.md 컨텍스트에 정보를 추가해요',
  'This extension will exclude the following core tools: {{tools}}':
    '이 확장은 다음 핵심 도구를 제외해요: {{tools}}',
  'This extension will install the following skills:':
    '이 확장은 다음 스킬을 설치해요:',
  'This extension will install the following subagents:':
    '이 확장은 다음 서브에이전트를 설치해요:',
  'Installation cancelled for "{{name}}".':
    '"{{name}}"에 대한 설치가 취소되었어요.',
  'You are installing an extension from {{originSource}}. Some features may not work perfectly with Moli Code.':
    '{{originSource}}에서 확장을 설치하고 있어요. 일부 기능이 Moli Code와 완벽하게 작동하지 않을 수 있어요.',
  '--ref and --auto-update are not applicable for marketplace extensions.':
    '--ref 및 --auto-update는 마켓플레이스 확장에 적용되지 않아요.',
  'Extension "{{name}}" installed successfully and enabled.':
    '확장 "{{name}}"이(가) 성공적으로 설치되고 활성화되었어요.',
  'Installs an extension from a git repository URL, local path, or claude marketplace (marketplace-url:plugin-name).':
    'git 저장소 URL, 로컬 경로 또는 claude 마켓플레이스(marketplace-url:plugin-name)에서 확장을 설치해요.',
  'The github URL, local path, or marketplace source (marketplace-url:plugin-name) of the extension to install.':
    '설치할 확장의 github URL, 로컬 경로 또는 마켓플레이스 소스(marketplace-url:plugin-name).',
  'The git ref to install from.': '설치할 git ref.',
  'Enable auto-update for this extension.':
    '이 확장에 대한 자동 업데이트를 활성화해요.',
  'Enable pre-release versions for this extension.':
    '이 확장에 대한 프리릴리스 버전을 활성화해요.',
  'Acknowledge the security risks of installing an extension and skip the confirmation prompt.':
    '확장 설치의 보안 위험을 확인하고 확인 프롬프트를 건너뜁니다.',
  'The source argument must be provided.': '소스 인수를 제공해야 해요.',
  'Extension "{{name}}" successfully uninstalled.':
    '확장 "{{name}}"이(가) 성공적으로 제거되었어요.',
  'Uninstalls an extension.': '확장을 제거해요.',
  'The name or source path of the extension to uninstall.':
    '제거할 확장의 이름 또는 소스 경로.',
  'Please include the name of the extension to uninstall as a positional argument.':
    '위치 인수로 제거할 확장의 이름을 포함하세요.',
  'Enables an extension.': '확장을 활성화해요.',
  'The name of the extension to enable.': '활성화할 확장의 이름.',
  'The scope to enable the extenison in. If not set, will be enabled in all scopes.':
    '확장을 활성화할 범위. 설정하지 않으면 모든 범위에서 활성화돼요.',
  'Extension "{{name}}" successfully enabled for scope "{{scope}}".':
    '범위 "{{scope}}"에 대해 확장 "{{name}}"이(가) 성공적으로 활성화되었어요.',
  'Extension "{{name}}" successfully enabled in all scopes.':
    '모든 범위에서 확장 "{{name}}"이(가) 성공적으로 활성화되었어요.',
  'Invalid scope: {{scope}}. Please use one of {{scopes}}.':
    '잘못된 범위: {{scope}}. {{scopes}} 중 하나를 사용하세요.',
  'Disables an extension.': '확장을 비활성화해요.',
  'The name of the extension to disable.': '비활성화할 확장의 이름.',
  'The scope to disable the extenison in.': '확장을 비활성화할 범위.',
  'Extension "{{name}}" successfully disabled for scope "{{scope}}".':
    '범위 "{{scope}}"에 대해 확장 "{{name}}"이(가) 성공적으로 비활성화되었어요.',
  'Extension "{{name}}" successfully updated: {{oldVersion}} → {{newVersion}}.':
    '확장 "{{name}}"이(가) 성공적으로 업데이트됨: {{oldVersion}} → {{newVersion}}.',
  'Unable to install extension "{{name}}" due to missing install metadata':
    '설치 메타데이터가 누락되어 확장 "{{name}}"을(를) 설치할 수 없어요',
  'Extension "{{name}}" is already up to date.':
    '확장 "{{name}}"이(가) 이미 최신 상태입니다.',
  'Updates all extensions or a named extension to the latest version.':
    '모든 확장 또는 지정된 확장을 최신 버전으로 업데이트해요.',
  'Update all extensions.': '모든 확장 업데이트.',
  'Either an extension name or --all must be provided':
    '확장 이름 또는 --all을 제공해야 해요',
  'Lists installed extensions.': '설치된 확장을 보여드려요.',
  'Path:': '경로:',
  'Source:': '소스:',
  'Type:': '유형:',
  'Ref:': 'Ref:',
  'Release tag:': '릴리스 태그:',
  'Enabled (User):': '활성화됨 (사용자):',
  'Enabled (Workspace):': '활성화됨 (작업 공간):',
  'Context files:': '컨텍스트 파일:',
  'Skills:': '스킬:',
  'Agents:': '에이전트:',
  'MCP servers:': 'MCP 서버:',
  'Link extension failed to install.': '링크 확장 설치 실패.',
  'Extension "{{name}}" linked successfully and enabled.':
    '확장 "{{name}}"이(가) 성공적으로 연결되고 활성화되었어요.',
  'Links an extension from a local path. Updates made to the local path will always be reflected.':
    '로컬 경로에서 확장을 연결해요. 로컬 경로의 변경 사항이 항상 반영돼요.',
  'The name of the extension to link.': '연결할 확장의 이름.',
  'Set a specific setting for an extension.': '확장의 특정 설정을 설정해요.',
  'Name of the extension to configure.': '구성할 확장의 이름.',
  'The setting to configure (name or env var).':
    '구성할 설정 (이름 또는 환경 변수).',
  'The scope to set the setting in.': '설정을 적용할 범위.',
  'List all settings for an extension.': '확장의 모든 설정을 보여드려요.',
  'Name of the extension.': '확장의 이름.',
  'Extension "{{name}}" has no settings to configure.':
    '확장 "{{name}}"에 구성할 설정이 없어요.',
  'Settings for "{{name}}":': '"{{name}}"의 설정:',
  '(workspace)': '(작업 공간)',
  '(user)': '(사용자)',
  '[not set]': '[설정되지 않음]',
  '[value stored in keychain]': '[키체인에 저장된 값]',
  'Value:': '값:',
  'Manage extension settings.': '확장 설정을 관리해요.',
  'You need to specify a command (set or list).':
    '명령(set 또는 list)을 지정해야 해요.',
  // ============================================================================
  // Plugin Choice / Marketplace
  // ============================================================================
  'No plugins available in this marketplace.':
    '이 마켓플레이스에서 사용 가능한 플러그인이 없어요.',
  'Select a plugin to install from marketplace "{{name}}":':
    '마켓플레이스 "{{name}}"에서 설치할 플러그인을 선택하세요:',
  'Plugin selection cancelled.': '플러그인 선택이 취소되었어요.',
  'Select a plugin from "{{name}}"': '"{{name}}"에서 플러그인 선택',
  'Use ↑↓ or j/k to navigate, Enter to select, Escape to cancel':
    '↑↓ 또는 j/k로 이동, Enter로 선택, Escape로 취소',
  '{{count}} more above': '위에 {{count}}개 더 있음',
  '{{count}} more below': '아래에 {{count}}개 더 있음',
  'manage IDE integration': 'IDE 통합 관리',
  'check status of IDE integration': 'IDE 통합 상태 확인',
  'install required IDE companion for {{ideName}}':
    '{{ideName}}에 필요한 IDE 동반자 설치',
  'enable IDE integration': 'IDE 통합 활성화',
  'disable IDE integration': 'IDE 통합 비활성화',
  'IDE integration is not supported in your current environment. To use this feature, run Moli Code in one of these supported IDEs: VS Code or VS Code forks.':
    '현재 환경에서는 IDE 통합이 지원되지 않아요. 이 기능을 사용하려면 VS Code 또는 VS Code 포크 중 하나에서 Moli Code를 실행하세요.',
  'Set up GitHub Actions': 'GitHub Actions 설정',
  'Configure terminal keybindings for multiline input (VS Code, Cursor, Windsurf, Trae)':
    '여러 줄 입력을 위한 터미널 키 바인딩 구성 (VS Code, Cursor, Windsurf, Trae)',
  'Please restart your terminal for the changes to take effect.':
    '변경 사항을 적용하려면 터미널을 다시 시작하세요.',
  'Failed to configure terminal: {{error}}': '터미널 구성 실패: {{error}}',
  'Could not determine {{terminalName}} config path on Windows: APPDATA environment variable is not set.':
    'Windows에서 {{terminalName}} 구성 경로를 확인할 수 없음: APPDATA 환경 변수가 설정되지 않았습니다.',
  '{{terminalName}} keybindings.json exists but is not a valid JSON array. Please fix the file manually or delete it to allow automatic configuration.':
    '{{terminalName}} keybindings.json이 존재하지만 유효한 JSON 배열이 아닙니다. 자동 구성을 허용하려면 파일을 수동으로 수정하거나 삭제하세요.',
  'File: {{file}}': '파일: {{file}}',
  'Failed to parse {{terminalName}} keybindings.json. The file contains invalid JSON. Please fix the file manually or delete it to allow automatic configuration.':
    '{{terminalName}} keybindings.json 구문 분석 실패. 파일에 잘못된 JSON이 포함되어 있어요. 자동 구성을 허용하려면 파일을 수동으로 수정하거나 삭제하세요.',
  'Error: {{error}}': '오류: {{error}}',
  'Shift+Enter binding already exists': 'Shift+Enter 바인딩이 이미 존재해요',
  'Ctrl+Enter binding already exists': 'Ctrl+Enter 바인딩이 이미 존재해요',
  'Existing keybindings detected. Will not modify to avoid conflicts.':
    '기존 키 바인딩이 감지되었어요. 충돌을 피하기 위해 수정하지 않아요.',
  'Please check and modify manually if needed: {{file}}':
    '필요한 경우 수동으로 확인하고 수정하세요: {{file}}',
  'Added Shift+Enter and Ctrl+Enter keybindings to {{terminalName}}.':
    '{{terminalName}}에 Shift+Enter 및 Ctrl+Enter 키 바인딩을 추가했어요.',
  'Modified: {{file}}': '수정됨: {{file}}',
  '{{terminalName}} keybindings already configured.':
    '{{terminalName}} 키 바인딩이 이미 구성되었어요.',
  'Failed to configure {{terminalName}}.':
    '{{terminalName}} 구성에 실패했어요.',
  'Your terminal is already configured for an optimal experience with multiline input (Shift+Enter and Ctrl+Enter).':
    '터미널이 이미 여러 줄 입력(Shift+Enter 및 Ctrl+Enter)에 최적화되도록 구성되어 있어요.',

  // ============================================================================
  // Commands - Hooks
  // ============================================================================
  'Manage Moli Code hooks': 'Moli Code 훅 관리',
  'List all configured hooks': '구성된 모든 훅 나열',
  'Enable a disabled hook': '비활성화된 훅 활성화',
  'Disable an active hook': '활성 훅 비활성화',

  // ============================================================================
  // Commands - Session Export
  // ============================================================================
  'Export current session message history to a file':
    '현재 세션 메시지 기록을 파일로 내보내기',
  'Export session to HTML format': 'HTML 형식으로 세션 내보내기',
  'Export session to JSON format': 'JSON 형식으로 세션 내보내기',
  'Export session to JSONL format (one message per line)':
    'JSONL 형식으로 세션 내보내기 (메시지당 한 줄)',
  'Export session to markdown format': 'Markdown 형식으로 세션 내보내기',

  // ============================================================================
  // Commands - Insights
  // ============================================================================
  'generate personalized programming insights from your chat history':
    '대화 기록에서 개인화된 프로그래밍 인사이트 생성',

  // ============================================================================
  // Commands - Session History
  // ============================================================================
  'Resume a previous session': '이전 세션 다시 시작',
  'Restore a tool call. This will reset the conversation and file history to the state it was in when the tool call was suggested':
    '도구 호출을 복원해요. 도구 호출이 제안되었을 때의 상태로 대화 및 파일 기록을 초기화합니다',
  'Could not detect terminal type. Supported terminals: VS Code, Cursor, Windsurf, and Trae.':
    '터미널 유형을 감지할 수 없어요. 지원되는 터미널: VS Code, Cursor, Windsurf 및 Trae.',
  'Terminal "{{terminal}}" is not supported yet.':
    '터미널 "{{terminal}}"은(는) 아직 지원되지 않아요.',

  // ============================================================================
  // Commands - Language
  // ============================================================================
  'Invalid language. Available: {{options}}':
    '잘못된 언어입니다. 사용 가능: {{options}}',
  'Language subcommands do not accept additional arguments.':
    '언어 하위 명령은 추가 인수를 받지 않아요.',
  'Current UI language: {{lang}}': '현재 UI 언어: {{lang}}',
  'Current LLM output language: {{lang}}': '현재 LLM 출력 언어: {{lang}}',
  'LLM output language not set': 'LLM 출력 언어가 설정되지 않음',
  'Set UI language': 'UI 언어 설정',
  'Set LLM output language': 'LLM 출력 언어 설정',
  'Usage: /language ui [{{options}}]': '사용법: /language ui [{{options}}]',
  'Usage: /language output <language>': '사용법: /language output 한국어',
  'Example: /language output 中文': '예: /language output 中文',
  'Example: /language output English': '예: /language output English',
  'Example: /language output 日本語': '예: /language output 日本語',
  'Example: /language output Português': '예: /language output Português',
  'UI language changed to {{lang}}': 'UI 언어가 {{lang}}(으)로 변경됨',
  'LLM output language set to {{lang}}':
    'LLM 출력 언어가 {{lang}}(으)로 설정됨',
  'LLM output language rule file generated at {{path}}':
    'LLM 출력 언어 규칙 파일이 {{path}}에 생성됨',
  'Please restart the application for the changes to take effect.':
    '변경 사항을 적용하려면 애플리케이션을 다시 시작하세요.',
  'Failed to generate LLM output language rule file: {{error}}':
    'LLM 출력 언어 규칙 파일 생성 실패: {{error}}',
  'Invalid command. Available subcommands:':
    '잘못된 명령입니다. 사용 가능한 하위 명령:',
  'Available subcommands:': '사용 가능한 하위 명령:',
  'To request additional UI language packs, please open an issue on GitHub.':
    '추가 UI 언어 팩을 요청하려면 GitHub에서 이슈를 열어주세요.',
  'Available options:': '사용 가능한 옵션:',
  'Set UI language to {{name}}': 'UI 언어를 {{name}}(으)로 설정',

  // ============================================================================
  // Commands - Approval Mode
  // ============================================================================
  'Tool Approval Mode': '도구 승인 모드',
  'Current approval mode: {{mode}}': '현재 승인 모드: {{mode}}',
  'Available approval modes:': '사용 가능한 승인 모드:',
  'Approval mode changed to: {{mode}}': '승인 모드가 다음으로 변경됨: {{mode}}',
  'Approval mode changed to: {{mode}} (saved to {{scope}} settings{{location}})':
    '승인 모드가 다음으로 변경됨: {{mode}} ({{scope}} 설정에 저장됨{{location}})',
  'Usage: /approval-mode <mode> [--session|--user|--project]':
    '사용법: /approval-mode <mode> [--session|--user|--project]',

  'Scope subcommands do not accept additional arguments.':
    '범위 하위 명령은 추가 인수를 받지 않아요.',
  'Plan mode - Analyze only, do not modify files or execute commands':
    '계획 모드 - 분석만 수행하며 파일을 수정하거나 명령을 실행하지 않아요',
  'Default mode - Require approval for file edits or shell commands':
    '기본 모드 - 파일 편집 또는 셸 명령에 대한 승인 필요',
  'Auto-edit mode - Automatically approve file edits':
    '자동 편집 모드 - 파일 편집 자동 승인',
  'YOLO mode - Automatically approve all tools':
    'YOLO 모드 - 모든 도구 자동 승인',
  '{{mode}} mode': '{{mode}} 모드',
  'Settings service is not available; unable to persist the approval mode.':
    '설정 서비스를 사용할 수 없어요. 승인 모드를 저장할 수 없어요.',
  'Failed to save approval mode: {{error}}': '승인 모드 저장 실패: {{error}}',
  'Failed to change approval mode: {{error}}': '승인 모드 변경 실패: {{error}}',
  'Apply to current session only (temporary)': '현재 세션에만 적용 (임시)',
  'Persist for this project/workspace': '이 프로젝트/작업 공간에 유지',
  'Persist for this user on this machine': '이 시스템의 이 사용자에게 유지',
  'Analyze only, do not modify files or execute commands':
    '분석만 수행하며 파일을 수정하거나 명령을 실행하지 않아요',
  'Require approval for file edits or shell commands':
    '파일 편집 또는 셸 명령에 대한 승인 필요',
  'Automatically approve file edits': '파일 편집 자동 승인',
  'Automatically approve all tools': '모든 도구 자동 승인',
  'Workspace approval mode exists and takes priority. User-level change will have no effect.':
    '작업 공간 승인 모드가 존재하며 우선 적용돼요. 사용자 수준 변경은 효과가 없어요.',
  'Apply To': '적용 대상',
  'User Settings': '사용자 설정',
  'Workspace Settings': '작업 공간 설정',

  // ============================================================================
  // Commands - Memory
  // ============================================================================
  'Commands for interacting with memory.':
    '메모리와 상호작용하는 명령어입니다.',
  'Show the current memory contents.': '현재 메모리 내용을 표시해요.',
  'Show project-level memory contents.':
    '프로젝트 수준 메모리 내용을 표시해요.',
  'Show global memory contents.': '전역 메모리 내용을 표시해요.',
  'Add content to project-level memory.':
    '프로젝트 수준 메모리에 내용을 추가해요.',
  'Add content to global memory.': '전역 메모리에 내용을 추가해요.',
  'Refresh the memory from the source.': '소스에서 메모리를 새로고침해요.',
  'Usage: /memory add --project <text to remember>':
    '사용법: /memory add --project <기억할 텍스트>',
  'Usage: /memory add --global <text to remember>':
    '사용법: /memory add --global <기억할 텍스트>',
  'Attempting to save to project memory: "{{text}}"':
    '프로젝트 메모리에 저장 중: "{{text}}"',
  'Attempting to save to global memory: "{{text}}"':
    '전역 메모리에 저장 중: "{{text}}"',
  'Current memory content from {{count}} file(s):':
    '{{count}}개 파일의 현재 메모리 내용:',
  'Memory is currently empty.': '메모리가 현재 비어있어요.',
  'Project memory file not found or is currently empty.':
    '프로젝트 메모리 파일을 찾을 수 없거나 현재 비어있어요.',
  'Global memory file not found or is currently empty.':
    '전역 메모리 파일을 찾을 수 없거나 현재 비어있어요.',
  'Global memory is currently empty.': '전역 메모리가 현재 비어있어요.',
  'Global memory content:\n\n---\n{{content}}\n---':
    '전역 메모리 내용:\n\n---\n{{content}}\n---',
  'Project memory content from {{path}}:\n\n---\n{{content}}\n---':
    '{{path}}의 프로젝트 메모리 내용:\n\n---\n{{content}}\n---',
  'Project memory is currently empty.': '프로젝트 메모리가 현재 비어있어요.',
  'Refreshing memory from source files...':
    '소스 파일에서 메모리를 새로고침하는 중...',
  'Add content to the memory. Use --global for global memory or --project for project memory.':
    '메모리에 내용을 추가해요. 전역 메모리는 --global, 프로젝트 메모리는 --project를 사용하세요.',
  'Usage: /memory add [--global|--project] <text to remember>':
    '사용법: /memory add [--global|--project] <기억할 텍스트>',
  'Attempting to save to memory {{scope}}: "{{fact}}"':
    '메모리 {{scope}}에 저장 중: "{{fact}}"',

  // ============================================================================
  // Commands - MCP
  // ============================================================================
  'Authenticate with an OAuth-enabled MCP server': 'OAuth 지원 MCP 서버에 인증',
  'List configured MCP servers and tools': '구성된 MCP 서버 및 도구 나열',
  'Restarts MCP servers.': 'MCP 서버를 다시 시작해요.',
  'Open MCP management dialog': 'MCP 관리 대화상자 열기',
  'Config not loaded.': '구성이 로드되지 않았습니다.',
  'Could not retrieve tool registry.': '도구 레지스트리를 검색할 수 없어요.',
  'No MCP servers configured with OAuth authentication.':
    'OAuth 인증으로 구성된 MCP 서버가 없어요.',
  'MCP servers with OAuth authentication:': 'OAuth 인증이 있는 MCP 서버:',
  'Use /mcp auth <server-name> to authenticate.':
    '/mcp auth <server-name>을(를) 사용해 인증하세요.',
  "MCP server '{{name}}' not found.":
    "MCP 서버 '{{name}}'을(를) 찾을 수 없어요.",
  "Successfully authenticated and refreshed tools for '{{name}}'.":
    "'{{name}}'에 대해 성공적으로 인증되고 도구를 새로고침했어요.",
  "Failed to authenticate with MCP server '{{name}}': {{error}}":
    "MCP 서버 '{{name}}' 인증 실패: {{error}}",
  "Re-discovering tools from '{{name}}'...":
    "'{{name}}'에서 도구를 다시 검색 중...",
  "Discovered {{count}} tool(s) from '{{name}}'.":
    "'{{name}}'에서 {{count}}개 도구를 검색했어요.",
  'Authentication complete. Returning to server details...':
    '인증 완료. 서버 상세 정보로 돌아가는 중...',
  'Authentication successful.': '인증에 성공했어요.',
  'If the browser does not open, copy and paste this URL into your browser:':
    '브라우저가 열리지 않으면 이 URL을 복사하여 브라우저에 붙여넣으세요:',
  'Make sure to copy the COMPLETE URL - it may wrap across multiple lines.':
    '전체 URL을 복사하세요 - 여러 줄에 걸쳐 있을 수 있어요.',

  // ============================================================================
  // MCP Management Dialog
  // ============================================================================
  'Manage MCP servers': 'MCP 서버 관리',
  'Server Detail': '서버 상세 정보',
  'Disable Server': '서버 비활성화',
  Tools: '도구',
  'Tool Detail': '도구 상세 정보',
  'MCP Management': 'MCP 관리',
  'Loading...': '로딩 중...',
  'Unknown step': '알 수 없는 단계',
  'Esc to back': 'Esc로 뒤로',
  '↑↓ to navigate · Enter to select · Esc to close':
    '↑↓로 이동 · Enter로 선택 · Esc로 닫기',
  '↑↓ to navigate · Enter to select · Esc to back':
    '↑↓로 이동 · Enter로 선택 · Esc로 뒤로',
  '↑↓ to navigate · Enter to confirm · Esc to back':
    '↑↓로 이동 · Enter로 확인 · Esc로 뒤로',
  'User Settings (global)': '사용자 설정 (전역)',
  'Workspace Settings (project-specific)': '작업 공간 설정 (프로젝트별)',
  'Disable server:': '서버 비활성화:',
  'Select where to add the server to the exclude list:':
    '서버를 제외 목록에 추가할 위치를 선택하세요:',
  'Press Enter to confirm, Esc to cancel': 'Enter로 확인, Esc로 취소',
  'View tools': '도구 보기',
  Reconnect: '재연결',
  Enable: '활성화',
  Disable: '비활성화',
  Authenticate: '인증',
  'Re-authenticate': '재인증',
  'Clear Authentication': '인증 초기화',
  'Server:': '서버:',
  'Command:': '명령:',
  'Working Directory:': '작업 디렉터리:',
  'Capabilities:': '기능:',
  'No server selected': '선택된 서버 없음',
  prompts: '프롬프트',
  '(disabled)': '(비활성화됨)',
  'Error:': '오류:',
  Extension: '확장',
  tool: '도구',
  tools: '도구',
  connected: '연결됨',
  connecting: '연결 중',
  disconnected: '연결 끊김',

  // MCP Server List
  'User MCPs': '사용자 MCP',
  'Project MCPs': '프로젝트 MCP',
  'Extension MCPs': '확장 MCP',
  server: '서버',
  servers: '서버',
  'Add MCP servers to your settings to get started.':
    '시작하려면 설정에 MCP 서버를 추가하세요.',
  'Run qwen --debug to see error logs':
    'moli --debug를 실행하여 오류 로그 확인',

  // MCP OAuth Authentication
  'OAuth Authentication': 'OAuth 인증',
  'Press Enter to start authentication, Esc to go back':
    'Enter로 인증 시작, Esc로 뒤로 가기',
  'Authenticating... Please complete the login in your browser.':
    '인증 중... 브라우저에서 로그인을 완료하세요.',
  'Press Enter or Esc to go back': 'Enter 또는 Esc로 뒤로 가기',

  // MCP Tool List
  'No tools available for this server.': '이 서버에 사용 가능한 도구가 없어요.',
  destructive: '파괴적',
  'read-only': '읽기 전용',
  'open-world': '오픈 월드',
  idempotent: '멱등성',
  'Tools for {{name}}': '{{name}}의 도구',
  'Tools for {{serverName}}': '{{serverName}}의 도구',
  '{{current}}/{{total}}': '{{current}}/{{total}}',

  // MCP Tool Detail
  required: '필수',
  Type: '유형',
  Enum: '열거형',
  Parameters: '매개변수',
  'No tool selected': '선택된 도구 없음',
  Annotations: '어노테이션',
  Title: '제목',
  'Read Only': '읽기 전용',
  Destructive: '파괴적',
  Idempotent: '멱등성',
  'Open World': '오픈 월드',
  Server: '서버',

  // Invalid tool related translations
  '{{count}} invalid tools': '{{count}}개 잘못된 도구',
  invalid: '잘못됨',
  'invalid: {{reason}}': '잘못됨: {{reason}}',
  'missing name': '이름 누락',
  'missing description': '설명 누락',
  '(unnamed)': '(이름 없음)',
  'Warning: This tool cannot be called by the LLM':
    '경고: 이 도구는 LLM에서 호출할 수 없어요',
  Reason: '이유',
  'Tools must have both name and description to be used by the LLM.':
    'LLM에서 사용하려면 도구에 이름과 설명이 모두 있어야 해요.',

  // ============================================================================
  // Commands - Chat
  // ============================================================================
  'Manage conversation history.': '대화 기록을 관리해요.',
  'List saved conversation checkpoints': '저장된 대화 체크포인트 나열',
  'No saved conversation checkpoints found.':
    '저장된 대화 체크포인트를 찾을 수 없어요.',
  'List of saved conversations:': '저장된 대화 목록:',
  'Note: Newest last, oldest first': '참고: 최신이 마지막, 오래된 것이 먼저',
  'Save the current conversation as a checkpoint. Usage: /chat save <tag>':
    '현재 대화를 체크포인트로 저장해요. 사용법: /chat save <tag>',
  'Missing tag. Usage: /chat save <tag>':
    '태그가 누락되었어요. 사용법: /chat save <tag>',
  'Delete a conversation checkpoint. Usage: /chat delete <tag>':
    '대화 체크포인트를 삭제해요. 사용법: /chat delete <tag>',
  'Missing tag. Usage: /chat delete <tag>':
    '태그가 누락되었어요. 사용법: /chat delete <tag>',
  "Conversation checkpoint '{{tag}}' has been deleted.":
    "대화 체크포인트 '{{tag}}'이(가) 삭제되었어요.",
  "Error: No checkpoint found with tag '{{tag}}'.":
    "오류: 태그 '{{tag}}'에 대한 체크포인트를 찾을 수 없어요.",
  'Resume a conversation from a checkpoint. Usage: /chat resume <tag>':
    '체크포인트에서 대화를 다시 시작해요. 사용법: /chat resume <tag>',
  'Missing tag. Usage: /chat resume <tag>':
    '태그가 누락되었어요. 사용법: /chat resume <tag>',
  'No saved checkpoint found with tag: {{tag}}.':
    '태그 {{tag}}에 대한 저장된 체크포인트를 찾을 수 없어요.',
  'A checkpoint with the tag {{tag}} already exists. Do you want to overwrite it?':
    '태그 {{tag}}를 가진 체크포인트가 이미 존재해요. 덮어쓰시겠습니까?',
  'No chat client available to save conversation.':
    '대화를 저장할 수 있는 채팅 클라이언트가 없어요.',
  'Conversation checkpoint saved with tag: {{tag}}.':
    '태그 {{tag}}로 대화 체크포인트가 저장되었어요.',
  'No conversation found to save.': '저장할 대화를 찾을 수 없어요.',
  'No chat client available to share conversation.':
    '대화를 공유할 수 있는 채팅 클라이언트가 없어요.',
  'Invalid file format. Only .md and .json are supported.':
    '잘못된 파일 형식입니다. .md와 .json만 지원돼요.',
  'Error sharing conversation: {{error}}': '대화 공유 오류: {{error}}',
  'Conversation shared to {{filePath}}': '대화가 {{filePath}}에 공유됨',
  'No conversation found to share.': '공유할 대화를 찾을 수 없어요.',
  'Share the current conversation to a markdown or json file. Usage: /chat share <file>':
    '현재 대화를 markdown 또는 json 파일로 공유해요. 사용법: /chat share <file>',

  // ============================================================================
  // Commands - Summary
  // ============================================================================
  'Generate a project summary and save it to .moli/PROJECT_SUMMARY.md':
    '프로젝트 요약을 생성하여 .moli/PROJECT_SUMMARY.md에 저장해요',
  'Generate a project summary and save it to .qwen/PROJECT_SUMMARY.md':
    '프로젝트 요약을 생성하여 .moli/PROJECT_SUMMARY.md에 저장해요',
  'No chat client available to generate summary.':
    '요약을 생성할 수 있는 채팅 클라이언트가 없어요.',
  'Already generating summary, wait for previous request to complete':
    '이미 요약을 생성 중입니다. 이전 요청이 완료될 때까지 기다리세요',
  'No conversation found to summarize.': '요약할 대화를 찾을 수 없어요.',
  'Failed to generate project context summary: {{error}}':
    '프로젝트 컨텍스트 요약 생성 실패: {{error}}',
  'Saved project summary to {{filePathForDisplay}}.':
    '프로젝트 요약이 {{filePathForDisplay}}에 저장되었어요.',
  'Saving project summary...': '프로젝트 요약 저장 중...',
  'Generating project summary...': '프로젝트 요약 생성 중...',
  'Failed to generate summary - no text content received from LLM response':
    '요약 생성 실패 - LLM 응답에서 텍스트 내용을 받지 못함',

  // ============================================================================
  // Commands - Model
  // ============================================================================
  'Switch the model for this session': '이 세션의 모델 전환',
  'Content generator configuration not available.':
    '콘텐츠 생성기 구성을 사용할 수 없어요.',
  'Authentication type not available.': '인증 유형을 사용할 수 없어요.',
  'No models available for the current authentication type ({{authType}}).':
    '현재 인증 유형({{authType}})에 사용 가능한 모델이 없어요.',

  // ============================================================================
  // Commands - Clear
  // ============================================================================
  'Starting a new session, resetting chat, and clearing terminal.':
    '새 세션을 시작하고, 채팅을 초기화하며, 터미널을 지웁니다.',
  'Starting a new session and clearing.': '새 세션을 시작하고 지웁니다.',

  // ============================================================================
  // Commands - Compress
  // ============================================================================
  'Already compressing, wait for previous request to complete':
    '이미 압축 중입니다. 이전 요청이 완료될 때까지 기다리세요',
  'Failed to compress chat history.': '대화 기록 압축 실패.',
  'Failed to compress chat history: {{error}}':
    '대화 기록 압축 실패: {{error}}',
  'Compressing chat history': '대화 기록 압축 중',
  'Chat history compressed from {{originalTokens}} to {{newTokens}} tokens.':
    '대화 기록이 {{originalTokens}} 토큰에서 {{newTokens}} 토큰으로 압축되었어요.',
  'Compression was not beneficial for this history size.':
    '이 기록 크기에는 압축이 유익하지 않았습니다.',
  'Chat history compression did not reduce size. This may indicate issues with the compression prompt.':
    '대화 기록 압축으로 크기가 줄어들지 않았습니다. 압축 프롬프트에 문제가 있을 수 있어요.',
  'Could not compress chat history due to a token counting error.':
    '토큰 계산 오류로 인해 대화 기록을 압축할 수 없어요.',
  'Chat history is already compressed.': '대화 기록이 이미 압축되었어요.',

  // ============================================================================
  // Commands - Directory
  // ============================================================================
  'Configuration is not available.': '구성을 사용할 수 없어요.',
  'Please provide at least one path to add.':
    '추가할 경로를 하나 이상 제공하세요.',
  'The /directory add command is not supported in restrictive sandbox profiles. Please use --include-directories when starting the session instead.':
    '/directory add 명령은 제한적인 샌드박스 프로필에서 지원되지 않아요. 대신 세션 시작 시 --include-directories를 사용하세요.',
  "Error adding '{{path}}': {{error}}": "'{{path}}' 추가 오류: {{error}}",
  'Successfully added MOLI.md files from the following directories if there are:\n- {{directories}}':
    '다음 디렉터리에서 MOLI.md 파일을 성공적으로 추가했어요(있는 경우):\n- {{directories}}',
  'Successfully added QWEN.md files from the following directories if there are:\n- {{directories}}':
    '다음 디렉터리에서 MOLI.md 파일을 성공적으로 추가했어요(있는 경우):\n- {{directories}}',
  'Error refreshing memory: {{error}}': '메모리 새로고침 오류: {{error}}',
  'Successfully added directories:\n- {{directories}}':
    '디렉터리를 성공적으로 추가했어요:\n- {{directories}}',
  'Current workspace directories:\n{{directories}}':
    '현재 작업 공간 디렉터리:\n{{directories}}',

  // ============================================================================
  // Commands - Docs
  // ============================================================================
  'Please open the following URL in your browser to view the documentation:\n{{url}}':
    '문서를 보려면 브라우저에서 다음 URL을 열어주세요:\n{{url}}',
  'Opening documentation in your browser: {{url}}':
    '브라우저에서 문서 열기: {{url}}',

  // ============================================================================
  // Dialogs - Tool Confirmation
  // ============================================================================
  'Do you want to proceed?': '계속 진행하시겠습니까?',
  'Yes, allow once': '예, 한 번만 허용',
  'Allow always': '항상 허용',
  Yes: '예',
  No: '아니요',
  'No (esc)': '아니요 (esc)',
  'Yes, allow always for this session': '예, 이 세션에서 항상 허용',
  'Modify in progress:': '수정 중:',
  'Save and close external editor to continue':
    '계속하려면 외부 편집기를 저장하고 닫으세요',
  'Apply this change?': '이 변경사항을 적용하시겠습니까?',
  'Yes, allow always': '예, 항상 허용',
  'Modify with external editor': '외부 편집기로 수정',
  'No, suggest changes (esc)': '아니요, 변경사항 제안 (esc)',
  "Allow execution of: '{{command}}'?":
    "'{{command}}' 실행을 허용하시겠습니까?",
  'Yes, allow always ...': '예, 항상 허용 ...',
  'Yes, and auto-accept edits': '예, 편집 자동 승인',
  'Yes, and manually approve edits': '예, 편집 수동 승인',
  'No, keep planning (esc)': '아니요, 계획 계속 (esc)',
  'URLs to fetch:': '가져올 URL:',
  'MCP Server: {{server}}': 'MCP 서버: {{server}}',
  'Tool: {{tool}}': '도구: {{tool}}',
  'Allow execution of MCP tool "{{tool}}" from server "{{server}}"?':
    '서버 "{{server}}"의 MCP 도구 "{{tool}}" 실행을 허용하시겠습니까?',
  'Yes, always allow tool "{{tool}}" from server "{{server}}"':
    '예, 서버 "{{server}}"의 도구 "{{tool}}"을(를) 항상 허용',
  'Yes, always allow all tools from server "{{server}}"':
    '예, 서버 "{{server}}"의 모든 도구를 항상 허용',

  // ============================================================================
  // Dialogs - Shell Confirmation
  // ============================================================================
  'Shell Command Execution': '셸 명령 실행',
  'A custom command wants to run the following shell commands:':
    '사용자 지정 명령이 다음 셸 명령을 실행하려고 해요:',

  // ============================================================================
  // Dialogs - Pro Quota
  // ============================================================================
  'Pro quota limit reached for {{model}}.':
    '{{model}}에 대한 Pro 할당량 한계에 도달했어요.',
  'Change auth (executes the /auth command)': '인증 변경 (/auth 명령 실행)',
  'Continue with {{model}}': '{{model}}(으)로 계속',

  // ============================================================================
  // Dialogs - Welcome Back
  // ============================================================================
  'Current Plan:': '현재 계획:',
  'Progress: {{done}}/{{total}} tasks completed':
    '진행률: {{done}}/{{total}} 작업 완료',
  ', {{inProgress}} in progress': ', {{inProgress}} 진행 중',
  'Pending Tasks:': '보류 중인 작업:',
  'What would you like to do?': '무엇을 하시겠습니까?',
  'Choose how to proceed with your session:': '세션을 어떻게 진행하시겠습니까:',
  'Start new chat session': '새 채팅 세션 시작',
  'Continue previous conversation': '이전 대화 계속',
  '👋 Welcome back! (Last updated: {{timeAgo}})':
    '👋 다시 오신 것을 환영해요! (마지막 업데이트: {{timeAgo}})',
  '🎯 Overall Goal:': '🎯 전체 목표:',

  // ============================================================================
  // Dialogs - Auth
  // ============================================================================
  'Get started': '시작하기',
  'Select Authentication Method': '인증 방법 선택',
  'OpenAI API key is required to use OpenAI authentication.':
    'OpenAI 인증을 사용하려면 OpenAI API 키가 필요해요.',
  'You must select an auth method to proceed. Press Ctrl+C again to exit.':
    '계속하려면 인증 방법을 선택해야 해요. 종료하려면 Ctrl+C를 다시 누르세요.',
  'Terms of Services and Privacy Notice': '서비스 약관 및 개인정보 처리방침',
  'Moli OAuth': 'Moli OAuth',
  'Free \u00B7 Up to 1,000 requests/day \u00B7 Moli latest models':
    '무료 \u00B7 일일 최대 1,000건 요청 \u00B7 Moli 최신 모델',
  'Login with MoliChat account to use daily free quota.':
    'MoliChat 계정으로 로그인하여 일일 무료 할당량을 사용하세요.',
  'Paid \u00B7 Up to 6,000 requests/5 hrs \u00B7 All Alibaba Cloud Coding Plan Models':
    '유료 \u00B7 5시간당 최대 6,000건 요청 \u00B7 모든 Alibaba Cloud 코딩 플랜 모델',
  'Alibaba Cloud Coding Plan': 'Alibaba Cloud 코딩 플랜',
  'Bring your own API key': '자체 API 키 사용',
  'API-KEY': 'API-KEY',
  'Use coding plan credentials or your own api-keys/providers.':
    '코딩 플랜 자격 증명 또는 자체 API 키/제공자를 사용하세요.',
  OpenAI: 'OpenAI',
  'Failed to login. Message: {{message}}': '로그인 실패. 메시지: {{message}}',
  'Authentication is enforced to be {{enforcedType}}, but you are currently using {{currentType}}.':
    '인증이 {{enforcedType}}(으)로 강제되지만 현재 {{currentType}}을(를) 사용 중입니다.',
  'Moli OAuth authentication timed out. Please try again.':
    'Moli OAuth 인증 시간 초과. 다시 시도해주세요.',
  'Moli OAuth authentication cancelled.': 'Moli OAuth 인증이 취소되었어요.',
  'Moli OAuth Authentication': 'Moli OAuth 인증',
  'Please visit this URL to authorize:': '인증하려면 이 URL을 방문하세요:',
  'Or scan the QR code below:': '또는 아래 QR 코드를 스캔하세요:',
  'Waiting for authorization': '인증 대기 중',
  'Time remaining:': '남은 시간:',
  '(Press ESC or CTRL+C to cancel)': '(ESC 또는 CTRL+C를 눌러 취소)',
  'Moli OAuth Authentication Timeout': 'Moli OAuth 인증 시간 초과',
  'OAuth token expired (over {{seconds}} seconds). Please select authentication method again.':
    'OAuth 토큰 만료({{seconds}}초 경과). 인증 방법을 다시 선택하세요.',
  'Press any key to return to authentication type selection.':
    '아무 키나 눌러 인증 유형 선택으로 돌아가세요.',
  'Waiting for Moli OAuth authentication...': 'Moli OAuth 인증 대기 중...',
  'Note: Your existing API key in settings.json will not be cleared when using Moli OAuth. You can switch back to OpenAI authentication later if needed.':
    '참고: Moli OAuth를 사용할 때 settings.json의 기존 API 키는 지워지지 않아요. 필요한 경우 나중에 OpenAI 인증으로 다시 전환할 수 있어요.',
  'Note: Your existing API key will not be cleared when using Moli OAuth.':
    '참고: Moli OAuth를 사용할 때 기존 API 키는 지워지지 않아요.',
  'Authentication timed out. Please try again.':
    '인증 시간 초과. 다시 시도해주세요.',
  'Waiting for auth... (Press ESC or CTRL+C to cancel)':
    '인증 대기 중... (ESC 또는 CTRL+C를 눌러 취소)',
  'Missing API key for OpenAI-compatible auth. Set settings.security.auth.apiKey, or set the {{envKeyHint}} environment variable.':
    'OpenAI 호환 인증의 API 키가 누락되었어요. settings.security.auth.apiKey를 설정하거나 {{envKeyHint}} 환경 변수를 설정하세요.',
  '{{envKeyHint}} environment variable not found.':
    '{{envKeyHint}} 환경 변수를 찾을 수 없어요.',
  '{{envKeyHint}} environment variable not found. Please set it in your .env file or environment variables.':
    '{{envKeyHint}} 환경 변수를 찾을 수 없어요. .env 파일 또는 환경 변수에 설정하세요.',
  '{{envKeyHint}} environment variable not found (or set settings.security.auth.apiKey). Please set it in your .env file or environment variables.':
    '{{envKeyHint}} 환경 변수를 찾을 수 없어요(또는 settings.security.auth.apiKey 설정). .env 파일 또는 환경 변수에 설정하세요.',
  'Missing API key for OpenAI-compatible auth. Set the {{envKeyHint}} environment variable.':
    'OpenAI 호환 인증의 API 키가 누락되었어요. {{envKeyHint}} 환경 변수를 설정하세요.',
  'Anthropic provider missing required baseUrl in modelProviders[].baseUrl.':
    'Anthropic 제공자에게 modelProviders[].baseUrl에 필요한 baseUrl이 누락되었어요.',
  'ANTHROPIC_BASE_URL environment variable not found.':
    'ANTHROPIC_BASE_URL 환경 변수를 찾을 수 없어요.',
  'Invalid auth method selected.': '잘못된 인증 방법이 선택되었어요.',
  'Failed to authenticate. Message: {{message}}':
    '인증 실패. 메시지: {{message}}',
  'Authenticated successfully with {{authType}} credentials.':
    '{{authType}} 자격 증명으로 인증에 성공했어요.',
  'Invalid MOLI_DEFAULT_AUTH_TYPE value: "{{value}}". Valid values are: {{validValues}}':
    '잘못된 MOLI_DEFAULT_AUTH_TYPE 값: "{{value}}". 유효한 값: {{validValues}}',
  'Invalid QWEN_DEFAULT_AUTH_TYPE value: "{{value}}". Valid values are: {{validValues}}':
    '잘못된 MOLI_DEFAULT_AUTH_TYPE 값: "{{value}}". 유효한 값: {{validValues}}',
  'OpenAI Configuration Required': 'OpenAI 구성 필요',
  'Please enter your OpenAI configuration. You can get an API key from':
    'OpenAI 구성을 입력하세요. 다음에서 API 키를 얻을 수 있어요',
  'API Key:': 'API 키:',
  'Invalid credentials: {{errorMessage}}': '잘못된 자격 증명: {{errorMessage}}',
  'Failed to validate credentials': '자격 증명 검증 실패',
  'Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel':
    'Enter로 계속, Tab/↑↓로 이동, Esc로 취소',

  // ============================================================================
  // Dialogs - Model
  // ============================================================================
  'Select Model': '모델 선택',
  '(Press Esc to close)': '(Esc를 눌러 닫기)',
  'Current (effective) configuration': '현재 (유효) 구성',
  AuthType: '인증 유형',
  'API Key': 'API 키',
  unset: '설정 안 함',
  '(default)': '(기본값)',
  '(set)': '(설정됨)',
  '(not set)': '(설정되지 않음)',
  Modality: '모달리티',
  'Context Window': '컨텍스트 윈도우',
  text: '텍스트',
  'text-only': '텍스트 전용',
  image: '이미지',
  pdf: 'pdf',
  audio: '오디오',
  video: '비디오',
  'not set': '설정되지 않음',
  none: '없음',
  unknown: '알 수 없음',
  "Failed to switch model to '{{modelId}}'.\n\n{{error}}":
    "'{{modelId}}' 모델로 전환 실패.\n\n{{error}}",
  'Moli 3.5 Plus — efficient hybrid model with leading coding performance':
    'Moli 3.5 Plus — 뛰어난 코딩 성능을 갖춘 효율적인 하이브리드 모델',
  'The latest Moli Vision model from Alibaba Cloud ModelStudio (version: moli-vl-plus-2025-09-23)':
    'Alibaba Cloud ModelStudio의 최신 Moli Vision 모델 (버전: moli-vl-plus-2025-09-23)',
  'The latest Moli Vision model from Alibaba Cloud ModelStudio (version: qwen3-vl-plus-2025-09-23)':
    'Alibaba Cloud ModelStudio의 최신 Moli Vision 모델 (버전: moli-vl-plus-2025-09-23)',

  // ============================================================================
  // Dialogs - Permissions
  // ============================================================================
  'Manage folder trust settings': '폴더 신뢰 설정 관리',

  // ============================================================================
  // Status Bar
  // ============================================================================
  'Using:': '사용 중:',
  '{{count}} open file': '{{count}}개 열린 파일',
  '{{count}} open files': '{{count}}개 열린 파일',
  '(ctrl+g to view)': '(ctrl+g로 보기)',
  '{{count}} {{name}} file': '{{count}}개 {{name}} 파일',
  '{{count}} {{name}} files': '{{count}}개 {{name}} 파일',
  '{{count}} MCP server': '{{count}}개 MCP 서버',
  '{{count}} MCP servers': '{{count}}개 MCP 서버',
  '{{count}} Blocked': '{{count}}개 차단됨',
  '(ctrl+t to view)': '(ctrl+t로 보기)',
  '(ctrl+t to toggle)': '(ctrl+t로 전환)',
  'Press Ctrl+C again to exit.': '종료하려면 Ctrl+C를 다시 누르세요.',
  'Press Ctrl+D again to exit.': '종료하려면 Ctrl+D를 다시 누르세요.',
  'Press Esc again to clear.': '지우려면 Esc를 다시 누르세요.',

  // ============================================================================
  // MCP Status
  // ============================================================================
  'No MCP servers configured.': '구성된 MCP 서버가 없어요.',
  '⏳ MCP servers are starting up ({{count}} initializing)...':
    '⏳ MCP 서버가 시작 중입니다 ({{count}}개 초기화 중)...',
  'Note: First startup may take longer. Tool availability will update automatically.':
    '참고: 첫 시작은 더 오래 걸릴 수 있어요. 도구 사용 가능 여부가 자동으로 업데이트돼요.',
  'Configured MCP servers:': '구성된 MCP 서버:',
  Ready: '준비됨',
  'Starting... (first startup may take longer)':
    '시작 중... (첫 시작은 더 오래 걸릴 수 있음)',
  Disconnected: '연결 끊김',
  '{{count}} tool': '{{count}}개 도구',
  '{{count}} tools': '{{count}}개 도구',
  '{{count}} prompt': '{{count}}개 프롬프트',
  '{{count}} prompts': '{{count}}개 프롬프트',
  '(from {{extensionName}})': '({{extensionName}}에서)',
  OAuth: 'OAuth',
  'OAuth expired': 'OAuth 만료됨',
  'OAuth not authenticated': 'OAuth 인증되지 않음',
  'tools and prompts will appear when ready':
    '도구와 프롬프트는 준비되면 표시돼요',
  '{{count}} tools cached': '{{count}}개 도구 캐시됨',
  'Tools:': '도구:',
  'Parameters:': '매개변수:',
  'Prompts:': '프롬프트:',
  Blocked: '차단됨',
  '💡 Tips:': '💡 팁:',
  Use: '사용',
  'to show server and tool descriptions': '서버 및 도구 설명 표시',
  'to show tool parameter schemas': '도구 매개변수 스키마 표시',
  'to hide descriptions': '설명 숨기기',
  'to authenticate with OAuth-enabled servers': 'OAuth 지원 서버에 인증',
  Press: '누르기',
  'to toggle tool descriptions on/off': '도구 설명 켜기/끄기',
  "Starting OAuth authentication for MCP server '{{name}}'...":
    "MCP 서버 '{{name}}'에 대한 OAuth 인증 시작 중...",
  'Restarting MCP servers...': 'MCP 서버 다시 시작 중...',

  // ============================================================================
  // Startup Tips
  // ============================================================================
  'Tips:': '팁:',
  'Use /compress when the conversation gets long to summarize history and free up context.':
    '대화가 길어지면 /compress를 사용하여 기록을 요약하고 컨텍스트를 확보하세요.',
  'Start a fresh idea with /clear or /new; the previous session stays available in history.':
    '/clear 또는 /new로 새로운 아이디어를 시작하세요. 이전 세션은 기록에서 계속 사용할 수 있어요.',
  'Use /bug to submit issues to the maintainers when something goes off.':
    '문제가 발생하면 /bug를 사용하여 관리자에게 이슈를 제출하세요.',
  'Switch auth type quickly with /auth.':
    '/auth로 인증 유형을 빠르게 전환하세요.',
  'You can run any shell commands from Moli Code using ! (e.g. !ls).':
    '!를 사용하여 몰리코드에서 모든 셸 명령을 실행할 수 있어요(예: !ls).',
  'Type / to open the command popup; Tab autocompletes slash commands and saved prompts.':
    '/를 입력하여 명령 팝업을 엽니다. Tab은 슬래시 명령과 저장된 프롬프트를 자동 완성해요.',
  'You can resume a previous conversation by running moli --continue or moli --resume.':
    'moli --continue 또는 moli --resume을 실행하여 이전 대화를 다시 시작할 수 있어요.',
  'You can switch permission mode quickly with Shift+Tab or /approval-mode.':
    'Shift+Tab 또는 /approval-mode로 모드를 빠르게 전환할 수 있어요.',
  'You can switch permission mode quickly with Tab or /approval-mode.':
    'Tab 또는 /approval-mode로 모드를 빠르게 전환할 수 있어요.',
  'Try /insight to generate personalized insights from your chat history.':
    '/insight를 사용하여 대화 기록에서 개인화된 인사이트를 생성해 보세요.',

  // ============================================================================
  // Exit Screen / Stats
  // ============================================================================
  'Agent powering down. Goodbye!': '몰리가 종료돼요. 다음에 봐요!',
  'To continue this session, run': '이 세션을 계속하려면, ',
  'Interaction Summary': '이번 세션 요약',
  'Session ID:': '세션 ID:',
  'Tool Calls:': '도구 호출:',
  'Success Rate:': '성공률:',
  'User Agreement:': '사용자 승인:',
  reviewed: '검토됨',
  'Code Changes:': '코드 변경:',
  Performance: '성능',
  'Wall Time:': '경과 시간:',
  'Agent Active:': '에이전트 활성:',
  'API Time:': 'API 시간:',
  'Tool Time:': '도구 시간:',
  'Session Stats': '세션 통계',
  'Model Usage': '모델 사용량',
  Reqs: '요청',
  'Input Tokens': '입력 토큰',
  'Output Tokens': '출력 토큰',
  'Savings Highlight:': '비용 절감:',
  'of input tokens were served from the cache, reducing costs.':
    '입력 토큰이 캐시에서 제공되어 비용이 절감되었어요.',
  'Tip: For a full token breakdown, run `/stats model`.':
    '팁: 전체 토큰 분석을 보려면 `/stats model`을 실행하세요.',
  'Model Stats For Nerds': '모델 통계 (상세)',
  'Tool Stats For Nerds': '도구 통계 (상세)',
  Metric: '지표',
  API: 'API',
  Requests: '요청',
  Errors: '오류',
  'Avg Latency': '평균 지연 시간',
  Tokens: '토큰',
  Total: '전체',
  Prompt: '프롬프트',
  Cached: '캐시됨',
  Thoughts: '생각',
  Tool: '도구',
  Output: '출력',
  'No API calls have been made in this session.':
    '이 세션에서 API 호출이 없었습니다.',
  'Tool Name': '도구 이름',
  Calls: '호출',
  'Success Rate': '성공률',
  'Avg Duration': '평균 소요 시간',
  'User Decision Summary': '사용자 결정 요약',
  'Total Reviewed Suggestions:': '검토된 총 제안:',
  ' » Accepted:': ' » 수락됨:',
  ' » Rejected:': ' » 거부됨:',
  ' » Modified:': ' » 수정됨:',
  ' Overall Agreement Rate:': ' 전체 동의율:',
  'No tool calls have been made in this session.':
    '이 세션에서 도구 호출이 없었습니다.',
  'Session start time is unavailable, cannot calculate stats.':
    '세션 시작 시간을 사용할 수 없어 통계를 계산할 수 없어요.',

  // ============================================================================
  // Command Format Migration
  // ============================================================================
  'Command Format Migration': '명령 형식 마이그레이션',
  'Found {{count}} TOML command file:':
    '{{count}}개 TOML 명령 파일을 찾았습니다:',
  'Found {{count}} TOML command files:':
    '{{count}}개 TOML 명령 파일을 찾았습니다:',
  '... and {{count}} more': '... 그리고 {{count}}개 더',
  'The TOML format is deprecated. Would you like to migrate them to Markdown format?':
    'TOML 형식은 더 이상 사용되지 않아요. Markdown 형식으로 마이그레이션하시겠습니까?',
  '(Backups will be created and original files will be preserved)':
    '(백업이 생성되며 원본 파일은 보존돼요)',

  // ============================================================================
  // Loading Phrases
  // ============================================================================
  'Waiting for user confirmation...': '사용자 확인 대기 중...',
  '(esc to cancel, {{time}})': '(esc로 취소, {{time}})',

  // ============================================================================
  // Loading Phrases
  // ============================================================================
  WITTY_LOADING_PHRASES: [
    '위키를 열심히 읽어보는 중...',
    '두쫀쿠를 사러 가는 중...',
    '우주와 주파수를 맞추는 중...',
    '잃어버린 세미콜론을 찾는 중...',
    '햄스터가 열심히 달리는 중...',
    '펀치라인을 섞는 중...',
    '추가 파일런을 건설하는 중...',
    '지혜의 구름을 만드는 중...',
    '알고리즘을 닦는 중...',
    '쏠과 달려가는 중...',
    '전자를 세는 중...',
    '인터넷을 조립하는 중...',
    '커피를 코드로 변환하는 중...',
    '서버를 예열하는 중...',
    '흰 토끼를 따라가는 중...',
    '진실은 여기에 있어요... 어딘가에...',
    '캐릭터 생성 화면을 만지작거리는 중...',
    '잠시만, 적절한 밈을 찾는 중...',
    '디지털 고양이를 모으는 중...',
    '거의 다 왔습니다... 아마도...',
    '햄스터들이 최대한 빨리 작업 중입니다...',
    '고양이를 쓰다듬는 중...',
    '베이스를 때리는 중...',
    '곰을 건드리는 중...',
    '밈에 대한 연구를 하는 중...',
    '흠... 생각해 볼게...',
    '땡겨요를 키는 중...',
    '시청역을 걷는 중...',
    '오늘의 운세를 보는 중...',
    '강아지를 쓰다듬는 중...',
    '에너지바를 먹는 중...',
    '구운 계란을 시키는 중...',
    '테스트 장표를 작성하는 중...',
    '낙타를 타러가는 중...',
    '와인 품종을 찾는 중...',
  ],

  // ============================================================================
  // Extension Settings Input
  // ============================================================================
  'Enter value...': '값 입력...',
  'Enter sensitive value...': '민감한 값 입력...',
  'Press Enter to submit, Escape to cancel': 'Enter로 제출, Escape로 취소',

  // ============================================================================
  // Command Migration Tool
  // ============================================================================
  'Markdown file already exists: {{filename}}':
    'Markdown 파일이 이미 존재해요: {{filename}}',
  'TOML Command Format Deprecation Notice':
    'TOML 명령 형식 더 이상 사용되지 않음 공지',
  'Found {{count}} command file(s) in TOML format:':
    'TOML 형식의 {{count}}개 명령 파일을 찾았습니다:',
  'The TOML format for commands is being deprecated in favor of Markdown format.':
    '명령의 TOML 형식은 Markdown 형식으로 대체되어 더 이상 사용되지 않아요.',
  'Markdown format is more readable and easier to edit.':
    'Markdown 형식이 더 읽기 쉽고 편집하기 쉽습니다.',
  'You can migrate these files automatically using:':
    '다음을 사용하여 파일을 자동으로 마이그레이션할 수 있어요:',
  'Or manually convert each file:': '또는 각 파일을 수동으로 변환:',
  'TOML: prompt = "..." / description = "..."':
    'TOML: prompt = "..." / description = "..."',
  'Markdown: YAML frontmatter + content': 'Markdown: YAML frontmatter + 내용',
  'The migration tool will:': '마이그레이션 도구는 다음을 수행해요:',
  'Convert TOML files to Markdown': 'TOML 파일을 Markdown으로 변환',
  'Create backups of original files': '원본 파일의 백업 생성',
  'Preserve all command functionality': '모든 명령 기능 보존',
  'TOML format will continue to work for now, but migration is recommended.':
    '당분간 TOML 형식은 계속 작동하지만, 마이그레이션을 권장해요.',

  // ============================================================================
  // Extensions - Explore Command
  // ============================================================================
  'Open extensions page in your browser': '브라우저에서 확장 페이지 열기',
  'Unknown extensions source: {{source}}.': '알 수 없는 확장 소스: {{source}}.',
  'Would open extensions page in your browser: {{url}} (skipped in test environment)':
    '브라우저에서 확장 페이지를 열었을 것입니다: {{url}} (테스트 환경에서 건너뜀)',
  'View available extensions at {{url}}': '{{url}}에서 사용 가능한 확장 보기',
  'Opening extensions page in your browser: {{url}}':
    '브라우저에서 확장 페이지 열기: {{url}}',
  'Failed to open browser. Check out the extensions gallery at {{url}}':
    '브라우저를 열지 못했어요. {{url}}에서 확장 갤러리를 확인하세요',

  // ============================================================================
  // Retry / Rate Limit
  // ============================================================================
  'Rate limit error: {{reason}}': '속도 제한 오류: {{reason}}',
  'Retrying in {{seconds}} seconds… (attempt {{attempt}}/{{maxRetries}})':
    '{{seconds}}초 후 재시도 중… (시도 {{attempt}}/{{maxRetries}})',
  'Press Ctrl+Y to retry': 'Ctrl+Y를 눌러 재시도',
  'No failed request to retry.': '재시도할 실패한 요청이 없어요.',
  'to retry last request': '마지막 요청 재시도',

  // ============================================================================
  // Coding Plan Authentication
  // ============================================================================
  'API key cannot be empty.': 'API 키는 비어있을 수 없어요.',
  'You can get your Coding Plan API key here':
    '여기서 코딩 플랜 API 키를 얻을 수 있어요',
  'API key is stored in settings.env. You can migrate it to a .env file for better security.':
    'API 키가 settings.env에 저장되어 있어요. 더 나은 보안을 위해 .env 파일로 마이그레이션할 수 있어요.',
  'New model configurations are available for Alibaba Cloud Coding Plan. Update now?':
    'Alibaba Cloud 코딩 플랜에 새 모델 구성을 사용할 수 있어요. 지금 업데이트하시겠습니까?',
  'Coding Plan configuration updated successfully. New models are now available.':
    '코딩 플랜 구성이 성공적으로 업데이트되었어요. 새 모델을 사용할 수 있어요.',
  'Coding Plan API key not found. Please re-authenticate with Coding Plan.':
    '코딩 플랜 API 키를 찾을 수 없어요. 코딩 플랜으로 다시 인증하세요.',
  'Failed to update Coding Plan configuration: {{message}}':
    '코딩 플랜 구성 업데이트 실패: {{message}}',

  // ============================================================================
  // Custom API Key Configuration
  // ============================================================================
  'You can configure your API key and models in settings.json':
    'settings.json에서 API 키와 모델을 구성할 수 있어요',
  'Refer to the documentation for setup instructions':
    '설정 지침은 문서를 참조하세요',

  // ============================================================================
  // Auth Dialog - View Titles and Labels
  // ============================================================================
  'Coding Plan': '코딩 플랜',
  "Paste your api key of Bailian Coding Plan and you're all set!":
    'Bailian 코딩 플랜의 API 키를 붙여넣으면 준비 완료!',
  Custom: '사용자 지정',
  'More instructions about configuring `modelProviders` manually.':
    '`modelProviders`를 수동으로 구성하는 방법에 대한 추가 안내.',
  'Select API-KEY configuration mode:': 'API-KEY 구성 모드 선택:',
  '(Press Escape to go back)': '(Escape를 눌러 뒤로 가기)',
  '(Press Enter to submit, Escape to cancel)': '(Enter로 제출, Escape로 취소)',
  'Select Region for Coding Plan': '코딩 플랜 지역 선택',
  'Choose based on where your account is registered':
    '계정이 등록된 지역을 기준으로 선택하세요',
  'Enter Coding Plan API Key': '코딩 플랜 API 키 입력',

  // ============================================================================
  // Coding Plan International Updates
  // ============================================================================
  'New model configurations are available for {{region}}. Update now?':
    '{{region}}에 새 모델 구성을 사용할 수 있어요. 지금 업데이트하시겠습니까?',
  '{{region}} configuration updated successfully. Model switched to "{{model}}".':
    '{{region}} 구성이 성공적으로 업데이트되었어요. 모델이 "{{model}}"(으)로 전환되었어요.',
  '{{region}} configuration updated successfully.':
    '{{region}} 구성이 성공적으로 업데이트되었어요.',
  'Authenticated successfully with {{region}}. API key and model configs saved to settings.json (backed up).':
    '{{region}}로 성공적으로 인증되었어요. API 키와 모델 구성이 settings.json에 저장되었어요 (백업됨).',
  'Authenticated successfully with {{region}}. API key and model configs saved to settings.json.':
    '{{region}}로 성공적으로 인증되었어요. API 키와 모델 구성이 settings.json에 저장되었어요.',
  'Authenticated successfully with Molimate. Default model: {{modelName}}':
    'Molimate로 성공적으로 인증되었어요. 기본 모델: {{modelName}}',
  'Tip: Use /model to switch between available Coding Plan models.':
    '팁: /model을 사용하여 사용 가능한 코딩 플랜 모델 간에 전환하세요.',

  // ============================================================================
  // Ask User Question Tool
  // ============================================================================
  'Please answer the following question(s):': '다음 질문에 답변해 주세요:',
  'Cannot ask user questions in non-interactive mode. Please run in interactive mode to use this tool.':
    '비대화형 모드에서는 사용자에게 질문할 수 없어요. 이 도구를 사용하려면 대화형 모드에서 실행하세요.',
  'User declined to answer the questions.':
    '사용자가 질문에 대한 답변을 거부했어요.',
  'User has provided the following answers:':
    '사용자가 다음 답변을 제공했어요:',
  'Failed to process user answers:': '사용자 답변 처리 실패:',
  'Type something...': '입력하세요...',
  Submit: '제출',
  'Submit answers': '답변 제출',
  Cancel: '취소',
  'Your answers:': '내 답변:',
  '(not answered)': '(답변하지 않음)',
  'Ready to submit your answers?': '답변을 제출하시겠습니까?',
  '↑/↓: Navigate | ←/→: Switch tabs | Enter: Select':
    '↑/↓: 이동 | ←/→: 탭 전환 | Enter: 선택',
  '↑/↓: Navigate | ←/→: Switch tabs | Space/Enter: Toggle | Esc: Cancel':
    '↑/↓: 이동 | ←/→: 탭 전환 | Space/Enter: 전환 | Esc: 취소',
  '↑/↓: Navigate | Space/Enter: Toggle | Esc: Cancel':
    '↑/↓: 이동 | Space/Enter: 전환 | Esc: 취소',
  '↑/↓: Navigate | Enter: Select | Esc: Cancel':
    '↑/↓: 이동 | Enter: 선택 | Esc: 취소',

  // ============================================================================
  // Molimate Authentication
  // ============================================================================
  'Authenticate with Molimate': '몰리메이트로 인증',
  'Molimate authentication': '몰리메이트 인증',
  'Authenticate using employee ID': '사번을 입력하여 인증',
  'Run in local environment': '로컬 환경에서 실행',
  'Local environment': '로컬 환경',
  'Manual configuration': '수동 설정',
  'Employee ID must contain only alphanumeric characters.':
    '행번은 영문과 숫자로만 구성되어야 합니다.',
  'Authentication failed.': '인증에 실패했습니다.',
  'You must select an authentication method. Press Ctrl+C again to exit.':
    '인증 방식을 선택해야 합니다. 계속하려면 Ctrl+C를 다시 누르세요.',
  'Select authentication method': '인증 방식 선택',
  'Authenticating...': '인증 중...',
  'Local environment setup': '로컬 환경 설정',
  'Terms of Service and Privacy Policy': '이용약관 및 개인정보처리방침',
  'For more details, please visit the MoliCode homepage.':
    '자세한 내용은 몰리코드 홈페이지에서 확인하세요.',
  'Molimate authentication failed:': '몰리메이트 인증 실패:',
  'Molimate authentication failed: {{status}} {{statusText}}':
    '몰리메이트 인증 실패: {{status}} {{statusText}}',
  'Molimate authentication timed out': '몰리메이트 인증 시간 초과',
  'Authentication request timed out. Please try again.':
    '인증 요청이 시간 초과되었습니다. 다시 시도해주세요.',
  'Please enter your employee ID.': '행번을 입력해주세요.',
  'Enter your employee ID to authenticate with Molimate.':
    '행번을 입력해 몰리메이트를 인증하세요.',
  'Press Enter to submit, Esc to go back':
    'Enter를 눌러 제출, Esc를 눌러 뒤로 가기',
  'Time expired.': '시간이 초과되었습니다.',
  'Authentication session has expired. Please try again.':
    '인증 세션이 만료되었습니다. 다시 시도해주세요.',
  'Press any key to return to authentication method selection.':
    '인증 방식 선택으로 돌아가려면 아무 키나 누르세요.',
  '(Press ESC to cancel)': '(ESC를 눌러 취소)',
  'Select a model to use': '사용할 모델 선택',
  'Code-focused model optimized for programming tasks':
    '프로그래밍 작업에 최적화된 코드 중심 모델',
  'Large-scale general purpose model': '대규모 범용 모델',
  'Enter to select, ↑↓ to navigate, Esc to go back':
    'Enter로 선택, ↑↓로 이동, Esc로 뒤로 가기',

  // ============================================================================
  // LocalConfigWizard
  // ============================================================================
  'Local Environment Configuration': '로컬 환경 설정',
  'Step 1: Enter model name (required)': '1단계: 모델명 입력 (필수)',
  'Model name is required.': '모델명은 필수입니다.',
  'Step 2: Enter API key (required)': '2단계: API 키 입력 (필수)',
  'API key is required.': 'API 키는 필수입니다.',
  'Step 3: Enter Base URL (optional)': '3단계: Base URL 입력 (선택사항)',
  'Default: {{defaultUrl}}': '기본값: {{defaultUrl}}',
  'Enter to continue, Esc to go back': 'Enter로 계속, Esc로 뒤로 가기',
  'Confirm Configuration': '설정 확인',
  'Model Name:': '모델명:',
  'Base URL:': 'Base URL:',
  'Enter to save configuration, Esc to go back':
    'Enter로 설정 저장, Esc로 뒤로 가기',

  // Remote version check
  'remote.update.available': '새 버전 사용 가능! {{current}} → {{latest}}',
  'remote.update.download': '다운로드',

  // v0.14.3 추가 번역
  '  (Original working directory)': '  (Original working directory)',
  '  (from settings)': '  (from settings)',
  '  Config Version: {{version}}': '  Config Version: {{version}}',
  '  Current Model: {{model}}': '  Current Model: {{model}}',
  '  Limit: Up to 1,000 requests/day': '  Limit: Up to 1,000 requests/day',
  '  Models: Qwen latest models\n': '  Models: Qwen latest models\n',
  '  Region: {{region}}': '  Region: {{region}}',
  '  Status: API key configured\n': '  Status: API key configured\n',
  '  Status: Configured\n': '  Status: Configured\n',
  '  Type: Free tier': '  Type: Free tier',
  '(←/→ or tab to cycle)': '(←/→ or tab to cycle)',
  'API key for Coding Plan': 'API key for Coding Plan',
  'Add a new rule…': '새 규칙 추가…',
  'Add directory to workspace': '작업공간에 디렉토리 추가',
  'Add directory…': '디렉토리 추가…',
  'Add {{type}} permission rule': '{{type}} 권한 규칙 추가',
  'After tool execution': '도구 실행 후',
  'After tool execution fails': '도구 실행 실패 후',
  'Alibaba Cloud (alibabacloud.com)': 'Alibaba Cloud (alibabacloud.com)',
  'Always allow for this user': '이 사용자에 대해 항상 허용',
  'Always allow in this project': '이 프로젝트에서 항상 허용',
  'Any use of the {{tool}} tool': '{{tool}} 도구의 모든 사용',
  'Authenticate using Moli OAuth': 'Moli OAuth로 인증',
  'Autocompact buffer': '자동 압축 버퍼',
  'Before conversation compaction': '대화 압축 전',
  'Before tool execution': '도구 실행 전',
  'Built-in tools': '내장 도구',
  'Checked in at .qwen/settings.json': 'Checked in at .qwen/settings.json',
  'Configured Hooks ({{count}} total)': 'Configured Hooks ({{count}} total)',
  'Configured hooks:': 'Configured hooks:',
  'Context Usage': 'Context Usage',
  'Context window': 'Context window',
  'Delete {{type}} rule?': 'Delete {{type}} rule?',
  'Desc:': 'Desc:',
  'Directory does not exist.': 'Directory does not exist.',
  'Enter directory path…': 'Enter directory path…',
  'Enter permission rule…': 'Enter permission rule…',
  'Enter the path to the directory:': 'Enter the path to the directory:',
  'Enter to confirm · Esc to cancel': 'Enter to confirm · Esc to cancel',
  'Enter to select · Esc to cancel': 'Enter to select · Esc to cancel',
  'Enter to select · Esc to go back': 'Enter to select · Esc to go back',
  'Enter to submit · Esc to cancel': 'Enter to submit · Esc to cancel',
  'Enter your Coding Plan API key: ': 'Enter your Coding Plan API key: ',
  'Error loading hooks:': 'Error loading hooks:',
  'Estimated pre-conversation overhead': 'Estimated pre-conversation overhead',
  'Event:': 'Event:',
  'Exit codes:': 'Exit codes:',
  'Extension:': 'Extension:',
  'Fast Model': 'Fast Model',
  'From project settings': 'From project settings',
  'From session': 'From session',
  'From user settings': 'From user settings',
  'Global - Alibaba Cloud': 'Global - Alibaba Cloud',
  'Hook Configuration - Disabled': 'Hook Configuration - Disabled',
  'Hook details': 'Hook details',
  'Loading hooks...': 'Loading hooks...',
  'Local Settings': 'Local Settings',
  'MCP tools': 'MCP tools',
  'Manage permission rules': 'Manage permission rules',
  'Memory files': 'Memory files',
  'No hook commands will execute': 'No hook commands will execute',
  'No hook config selected': 'No hook config selected',
  'No hook events found.': 'No hook events found.',
  'No hook selected': 'No hook selected',
  'No hooks configured for this event.': 'No hooks configured for this event.',
  'Or simply run:': 'Or simply run:',
  'Path is not a directory.': 'Path is not a directory.',
  'Permissions:': 'Permissions:',
  'Press Escape to close': 'Press Escape to close',
  'Project settings': 'Project settings',
  'Project settings (local)': 'Project settings (local)',
  'Remove directory?': 'Remove directory?',
  'Saved in .qwen/settings.local.json': 'Saved in .qwen/settings.local.json',
  'Saved in at ~/.qwen/settings.json': 'Saved in at ~/.qwen/settings.json',
  'Search…': 'Search…',
  'Select an option:': 'Select an option:',
  'Select authentication method:': 'Select authentication method:',
  'Select region for Coding Plan:': 'Select region for Coding Plan:',
  'Set up Moli Code\'s status line UI': 'Set up Moli Code\'s status line UI',
  'Show current authentication status': 'Show current authentication status',
  'StatusLine will not be displayed': 'StatusLine will not be displayed',
  'System Settings': 'System Settings',
  'System prompt': 'System prompt',
  'Usage by category': 'Usage by category',
  'User settings': 'User settings',
  'When a new session is started': 'When a new session is started',
  'When a session is ending': 'When a session is ending',
  'When hooks are disabled:': 'When hooks are disabled:',
  'When notifications are sent': 'When notifications are sent',
  'When the user submits a prompt': 'When the user submits a prompt',
  'Where should this rule be saved?': 'Where should this rule be saved?',
  '\n=== Authentication Status ===\n': '\n=== Authentication Status ===\n',
  'block compaction': 'block compaction',
  'body loaded': 'body loaded',
  'command completes successfully': 'command completes successfully',
  'e.g.,': 'e.g.,',
  'show stderr to model immediately': 'show stderr to model immediately',
  'show stderr to user only': 'show stderr to user only',
  'stdout shown to Qwen': 'stdout shown to Qwen',
  'stdout shown to subagent': 'stdout shown to subagent',
  'stdout/stderr not shown': 'stdout/stderr not shown',
  'use hook decision if provided': 'use hook decision if provided',
  '{{count}} configured hook': '{{count}} configured hook',
  '{{count}} configured hooks': '{{count}} configured hooks',
  '{{count}} hook configured': '{{count}} hook configured',
  '{{count}} hooks configured': '{{count}} hooks configured',
  '✓ Authentication Method: Moli OAuth': '✓ Authentication Method: Moli OAuth',
  '✓ Authentication Method: {{type}}': '✓ Authentication Method: {{type}}',
  '✓ Enabled': '✓ Enabled',
  '✗ Disabled': '✗ Disabled',
  '中国 (China)': '中国 (China)',
  '中国 (China) - 阿里云百炼': '中国 (China) - 阿里云百炼',
  '阿里云百炼 (aliyun.com)': '阿里云百炼 (aliyun.com)',
};