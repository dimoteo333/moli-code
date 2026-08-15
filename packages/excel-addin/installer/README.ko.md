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

설치를 시작하면 변경 전에 설치할 에디션을 선택합니다.

```text
설치할 제품을 선택하세요:
  1. Molicode
  2. Molicode for Global
선택 [1-2]:
```

Standard와 Global은 같은 Office 추가 기능 ID 및 설치 경로를 사용합니다. 한 계정에
둘을 나란히 설치할 수 없으며, 한 에디션을 설치한 뒤 다른 에디션을 같은 경로에
설치하면 이전 에디션의 설치물과 설정이 새 에디션으로 교체됩니다.

### 설치 옵션

```powershell
.\installer\install.ps1 -Port 40000          # 다른 포트 사용
.\installer\install.ps1 -UseCatalog          # 공유 폴더 카탈로그 방식 (관리자 권한 필요)
.\installer\install.ps1 -Machine             # 인증서를 컴퓨터 저장소에 설치 (관리자, 확인창 없음)
.\installer\install.ps1 -NoAutoStart         # 로그온 자동 시작 등록 안 함
.\installer\install.ps1 -Edition Standard    # Standard 무인 설치
.\installer\install.ps1 -Edition Global      # Global 무인 설치
```

설치 전 결과를 확인하되 PC를 전혀 변경하지 않으려면 `-PlanOnly`를 사용합니다.
실제 설치와 같은 카탈로그 검증과 매니페스트 렌더링을 수행하고
`MOLI_INSTALL_PLAN=` JSON을 출력하지만 파일, 인증서, 레지스트리 또는 작업
스케줄러는 변경하지 않습니다.

```powershell
.\installer\install.ps1 -PlanOnly -Edition Standard
.\installer\install.ps1 -PlanOnly -Edition Global
```

- 기본 방식은 레지스트리(`HKCU\...\WEF\Developer`) 사이드로딩으로 **관리자 권한이 필요 없습니다.**
- 구버전 Excel 2016에서 추가 기능이 목록에 보이지 않으면 `-UseCatalog`로 재설치하세요.

## 모델 서버 설정

에이전트가 사용할 LLM 엔드포인트는 몰리 코드 CLI의 설정을 그대로 따릅니다
(`~/.moli` 설정 또는 사내 molimate 설정). 폐쇄망 내부의 모델 게이트웨이 주소가
설정되어 있어야 응답이 생성됩니다.

## Global 회계 보고서

Global 에디션은 별도의 작업창 버튼을 추가하지 않습니다. 작업창에서 회계, 원장,
결산, 조정, 비용, 시산표 또는 재무 요약 보고서를 자연어로 요청하면 회계 보고서
전문 에이전트를 사용할 수 있습니다. Standard 에디션에는 이 전문 에이전트가
등록되거나 노출되지 않습니다.

전문 에이전트는 먼저 원본 시트와 범위를 조사합니다. 필수 열, 보고 기간, 통화,
회계 기준이 모호하면 쓰기 전에 정확한 확인 질문 하나를 하며, 원본 회계 값을
추정·발명·자동 보정하거나 덮어쓰지 않습니다. 보고서는 새 `회계보고서` 시트에
만들고, 같은 이름이 있으면 `회계보고서 (2)`, `회계보고서 (3)`처럼 사용하지 않은
다음 이름을 선택합니다. 기존 시트는 바꾸지 않으며, 보고서 작성도 아래의 일반
쓰기 승인 절차를 거쳐야 합니다.

설치 후 `config.json`은 선택한 제품을 다음 필드로 저장합니다.

```json
{
  "edition": "global",
  "profileCatalogPath": "profiles/product-profiles.json",
  "enabledGlobalTools": ["accounting-report"]
}
```

Standard에서는 `edition`이 `standard`이고 `enabledGlobalTools`는 빈 배열입니다.
`profileCatalogPath`는 `config.json`의 상대 경로이며, 카탈로그의 정확한 상대 위치는
`profiles/product-profiles.json`입니다. Global 전용 전문 에이전트를 확장하려면 이
카탈로그의 `globalTools`에 항목을 추가하고, 기본 활성화할 전문 에이전트의 ID는
Global 프로필의 `defaultGlobalTools` 배열에도 추가합니다.

## 동작 확인

- 브라우저에서 `https://localhost:39215/health` → `{"status":"ok",...}`
- 로그: `%LOCALAPPDATA%\MoliCode\ExcelAddin\logs\sidecar.log`
- 도구 권한: 셀 쓰기/서식 등 변경 작업은 작업창에서 [허용]을 눌러야 실행됩니다.
  `config.json`의 `excludeTools`로 차단 도구를 조정할 수 있습니다
  (기본: ShellTool, web_fetch, web_search 차단).

## 배포 산출물

`deploy/`, 오프라인 zip, 데모 통합 문서 및 생성된 보고서는 빌드 또는 런타임
산출물입니다. 배포 시 생성할 수 있지만 Git에는 저장하거나 커밋하지 않습니다.

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
