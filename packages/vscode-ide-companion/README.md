# Moli Code Companion

Moli Code Companion은 VS Code 안에서 Moli Code를 바로 실행하고, 현재 워크스페이스 문맥을 유지한 채 대화, 코드 수정, 파일 참조, diff 검토까지 이어서 처리할 수 있도록 만든 전용 확장입니다.

별도의 전역 CLI 설치 없이도 확장 내부에 번들된 Moli Code를 사용하며, 편집기 안에서 자연스럽게 에이전트 작업 흐름을 이어갈 수 있습니다.

## 주요 기능

- VS Code 사이드바에서 Moli Code 채팅 열기
- 현재 워크스페이스, 열린 파일, 선택 영역 문맥과 연동
- 코드 변경 사항을 VS Code diff 화면에서 검토하고 수락 또는 닫기
- 여러 세션 기록 조회 및 이어서 작업
- 번들된 CLI 기반 실행으로 오프라인 배포 패키지와 함께 사용 가능

## 사용 환경

- Visual Studio Code 1.85.0 이상
- Cursor, Windsurf 등 VS Code 기반 에디터에서도 사용 가능

## 시작하기

1. 확장을 설치합니다.
2. 명령 팔레트에서 `Moli Code: Open`을 실행하거나 에디터 우측 상단의 Moli Code 아이콘을 클릭합니다.
3. 채팅 패널이 열리면 바로 Moli Code와 대화를 시작합니다.

## 제공 명령어

| 명령어                                | 설명                                       |
| ------------------------------------- | ------------------------------------------ |
| `Moli Code: Open`                     | Moli Code 채팅 패널을 엽니다.              |
| `Moli Code: Run`                      | 번들된 Moli Code CLI를 실행합니다.         |
| `Moli Code: Accept Current Diff`      | 현재 열려 있는 diff 변경사항을 반영합니다. |
| `Moli Code: Close Diff Editor`        | 현재 diff 편집기를 닫습니다.               |
| `Moli Code: View Third-Party Notices` | 서드파티 고지 문서를 엽니다.               |

## 오프라인 설치

사내 배포나 폐쇄망 환경에서는 제공된 VSIX 파일을 사용해 설치할 수 있습니다.

```bash
code --install-extension moli-code-vscode-ide-companion-<version>.vsix --force
```

## 이런 작업에 적합합니다

- 레포지토리 구조를 이해한 뒤 코드 수정 요청하기
- 현재 파일이나 선택 영역 기준으로 수정/설명 받기
- 생성된 변경사항을 diff로 검토한 뒤 반영하기
- CLI와 IDE 경험을 같은 워크플로우로 묶어서 사용하기

## 문제 제보

- 버그 신고: https://github.com/dimoteo333/moli-code/issues/new?template=bug_report.yml&labels=bug,vscode-ide-companion
- 기능 제안: https://github.com/dimoteo333/moli-code/issues/new?template=feature_request.yml&labels=enhancement,vscode-ide-companion

## 참고

- 프로젝트 저장소: https://github.com/dimoteo333/moli-code
- 릴리스: https://github.com/dimoteo333/moli-code/releases

## 이용 안내

이 확장을 설치하면 Moli Code 관련 이용약관 및 개인정보처리방침 안내를 함께 따릅니다.

## 라이선스

Apache-2.0
