# 몰리 코드 for PowerPoint — 폐쇄망 설치 안내

Windows PowerPoint 2016 이상에서 동작하는 몰리 코드 AI 어시스턴트 작업창 추가 기능입니다.
웹 자산, `office.js`, Node 런타임과 몰리 CLI가 패키지에 포함되어 설치 시 외부
인터넷 연결이 필요 없습니다.

## 설치

1. ZIP을 대상 PC의 로컬 폴더에 모두 압축 해제합니다.
2. Windows PowerShell에서 다음 명령을 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\install.ps1
```

3. localhost 인증서 신뢰 확인창이 표시되면 [예]를 선택합니다.
4. PowerPoint를 모두 종료하고 다시 실행합니다.
5. **삽입 > 내 추가 기능**에서 “몰리 코드 for PowerPoint”를 선택합니다.

기본 설치는 현재 사용자 레지스트리에 등록되므로 관리자 권한이 필요 없습니다.
구버전 Office에서 추가 기능이 보이지 않으면 관리자 PowerShell에서
`install.ps1 -UseCatalog`를 실행하십시오.

## 옵션

```powershell
.\installer\install.ps1 -Port 40016
.\installer\install.ps1 -UseCatalog
.\installer\install.ps1 -Machine
.\installer\install.ps1 -NoAutoStart
```

기본 포트는 Excel 추가 기능과 겹치지 않는 `39216`이며 설치 위치는
`%LOCALAPPDATA%\MoliCode\PowerPointAddin`입니다.

## 사용

입력창의 `📌` 버튼으로 Markdown 같은 로컬 텍스트 파일을 선택하면
`@파일명` 참조가 삽입됩니다. 메시지를 보내면 파일 내용도 AI 프롬프트 컨텍스트에
포함됩니다. 파일은 로컬 사이드카로만 전달되며, 모델 통신은 조직에서 설정한 사내
게이트웨이를 따릅니다.

몰리가 선택 질문을 보내는 경우 전용 창에서 단일/복수 항목을 선택하거나 “기타”에
직접 답을 입력할 수 있습니다.

## 확인 및 문제 해결

- 상태: `https://localhost:39216/health`
- 로그: `%LOCALAPPDATA%\MoliCode\PowerPointAddin\logs\sidecar.log`
- 작업창이 비어 있으면 설치 스크립트를 다시 실행해 인증서를 신뢰합니다.
- 연결이 끊기면 `start-sidecar.vbs`를 실행하거나 로그온 자동 시작 작업을 확인합니다.
- WebSocket이 차단되면 사내 GPO에서 localhost WebSocket 허용 여부를 확인합니다.

## 제거

```powershell
powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\MoliCode\PowerPointAddin\installer\uninstall.ps1"
```
