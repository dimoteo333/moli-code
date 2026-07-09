# 몰리 코드 for Excel — 폐쇄망 설치 안내

Excel 2016 이상(Windows)에서 동작하는 몰리 코드 AI 어시스턴트 작업창 추가 기능입니다.
모든 자산(office.js 포함)이 로컬에 포함되어 있어 **외부 인터넷 연결 없이** 동작합니다.

## 구성

| 폴더         | 내용                                          |
| ------------ | --------------------------------------------- |
| `web/`       | 작업창 웹 자산 (office.js 오프라인 번들 포함) |
| `sidecar/`   | 로컬 사이드카 서버 (`node.exe` + `index.cjs`) |
| `cli/`       | 몰리 코드 CLI 번들                            |
| `manifest/`  | Office 추가 기능 매니페스트 템플릿            |
| `installer/` | 설치/제거 스크립트                            |

## 설치 (원클릭)

1. 이 폴더 전체를 대상 PC로 복사합니다 (압축 해제).
2. PowerShell에서 실행:

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\install.ps1
```

3. 설치 중 **Windows 보안 확인창**이 뜨면 [예]를 누릅니다 (localhost HTTPS 인증서 신뢰).
4. Excel을 다시 시작한 뒤 **삽입 > 내 추가 기능**에서 "몰리 코드 for Excel"을 선택합니다.

### 설치 옵션

```powershell
.\installer\install.ps1 -Port 40000          # 다른 포트 사용
.\installer\install.ps1 -UseCatalog          # 공유 폴더 카탈로그 방식 (관리자 권한 필요)
.\installer\install.ps1 -Machine             # 인증서를 컴퓨터 저장소에 설치 (관리자, 확인창 없음)
.\installer\install.ps1 -NoAutoStart         # 로그온 자동 시작 등록 안 함
```

- 기본 방식은 레지스트리(`HKCU\...\WEF\Developer`) 사이드로딩으로 **관리자 권한이 필요 없습니다.**
- 구버전 Excel 2016에서 추가 기능이 목록에 보이지 않으면 `-UseCatalog`로 재설치하세요.

## 모델 서버 설정

에이전트가 사용할 LLM 엔드포인트는 몰리 코드 CLI의 설정을 그대로 따릅니다
(`~/.moli` 설정 또는 사내 molimate 설정). 폐쇄망 내부의 모델 게이트웨이 주소가
설정되어 있어야 응답이 생성됩니다.

## 동작 확인

- 브라우저에서 `https://localhost:39215/health` → `{"status":"ok",...}`
- 로그: `%LOCALAPPDATA%\MoliCode\ExcelAddin\logs\sidecar.log`
- 도구 권한: 셀 쓰기/서식 등 변경 작업은 작업창에서 [허용]을 눌러야 실행됩니다.
  `config.json`의 `excludeTools`로 차단 도구를 조정할 수 있습니다
  (기본: ShellTool, web_fetch, web_search 차단).

## 제거

```powershell
powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\MoliCode\ExcelAddin\installer\uninstall.ps1"
```

## 문제 해결

| 증상                         | 조치                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| 작업창이 빈 화면/인증서 오류 | `install.ps1` 재실행 후 확인창에서 [예]. IE 옵션에서 localhost 신뢰 확인 |
| 추가 기능이 목록에 없음      | Excel 완전 재시작 → 그래도 없으면 `-UseCatalog` 재설치                   |
| "연결 끊김" 표시             | 사이드카 미실행. 로그온 재시작 또는 `start-sidecar.vbs` 실행             |
| 포트 충돌 로그               | `install.ps1 -Port <다른포트>` 재실행                                    |
| WebSocket 사용 불가 안내     | 그룹 정책이 IE WebSocket을 차단 — IT 관리자 문의                         |
