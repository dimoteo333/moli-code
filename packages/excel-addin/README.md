# @dobby/moli-code-excel-addin

폐쇄망(air-gapped) Windows 환경의 Excel 2016+에서 동작하는 몰리 코드 작업창 추가 기능.

```
Excel 작업창 (IE11/ES5, office.js 오프라인 번들)
   │  wss://localhost:39215/ws  (토큰 인증 WebSocket)
   ▼
사이드카 (Node, HTTPS 정적 서빙 + 브리지)
   │  @dobby/moli-code-sdk  query()  ← stream-json stdio
   ▼
moli-code CLI  ←→  사내 LLM 게이트웨이
```

- 에이전트의 워크북 조작은 SDK 내장 MCP 서버(`excel_*` 도구 9종)가
  WebSocket으로 작업창에 전달하고, 작업창이 `Excel.run()`으로 실행해 응답합니다.
- 쓰기 도구는 작업창의 승인 모달(허용/항상 허용/거부)을 거칩니다.
- 작업창 연결 시 CLI 세션을 미리 시작하고 초기화가 끝난 뒤 준비 상태를 알립니다.
  `query_spawn_started`, `cli_initialized`, `user_message_enqueued`,
  `first_delta_received` 이벤트로 작업창 연결부터 첫 응답까지 구간을 분리 측정할 수
  있습니다.

## 개발 (macOS)

```bash
npm run build --workspace=packages/excel-addin     # 전체 빌드 (ES5 게이트 포함)
npm run dev --workspace=packages/excel-addin       # 사이드카 실행 (dev 인증서 자동 생성)
# 브라우저: https://localhost:39215/taskpane.html?mock=1  (Excel 없이 모의 워크북)
npm test --workspace=packages/excel-addin
```

에이전트 응답까지 보려면 리포 루트에서 `npm run bundle`로 `dist/cli.js`를 만들고
모델 엔드포인트 설정(`~/.moli` 또는 molimate 설정)이 있어야 합니다.
`MOLI_CODE_CLI_PATH`로 CLI 경로를 바꿀 수 있습니다.

## 배포 패키지 생성

```bash
npm run package:deploy --workspace=packages/excel-addin
# → packages/excel-addin/deploy/ + moli-excel-addin-<버전>-offline.zip
```

빌드 머신에서 node.exe(win-x64)를 한 번 내려받아 동봉하므로, zip 자체는
폐쇄망에서 네트워크 없이 설치됩니다. 설치 방법은 `installer/README.ko.md` 참고.

## Standard / Global 에디션

설치 프로그램은 하나의 추가 기능 ID와 설치 경로를 Standard와 Global이 함께
사용합니다. 따라서 두 에디션을 동시에 설치할 수 없으며, 같은 경로에 다른
에디션을 다시 설치하면 기존 에디션의 매니페스트와 설정을 새 에디션으로
교체합니다.

`install.ps1`를 인수 없이 실행하면 변경을 시작하기 전에 다음 메뉴에서 제품을
선택합니다.

```text
설치할 제품을 선택하세요:
  1. Molicode
  2. Molicode for Global
선택 [1-2]:
```

무인 설치에는 다음처럼 에디션을 명시합니다. 대소문자는 구분하지 않지만 값은
`Standard` 또는 `Global`이어야 합니다.

```powershell
.\installer\install.ps1 -Edition Standard
.\installer\install.ps1 -Edition Global
```

설치를 미리 점검할 때는 `-PlanOnly`를 사용합니다. 이는 실제 설치와 같은
프로필 검증·매니페스트 렌더링 경로를 사용하지만 파일, 인증서, 레지스트리,
작업 스케줄러를 변경하지 않고 `MOLI_INSTALL_PLAN=` JSON 한 줄만 출력합니다.

```powershell
.\installer\install.ps1 -PlanOnly -Edition Standard
.\installer\install.ps1 -PlanOnly -Edition Global
```

Global은 별도 작업창 버튼이 아니라 자연어 요청으로 동작합니다. 회계, 원장,
결산, 조정, 비용, 시산표 또는 재무 요약 보고서를 요청하면 주 에이전트가
`global-accounting-report` 전문 에이전트를 사용할 수 있습니다. Standard에는 이
전문 에이전트가 등록되거나 노출되지 않습니다.

Global 회계 보고서는 먼저 원본 시트와 범위를 살펴봅니다. 필수 열, 보고 기간,
통화 또는 회계 기준이 모호하면 쓰기 전에 정확한 확인 질문 하나를 하고, 값을
추정·발명·자동 보정하지 않습니다. 기존 원본 값이나 시트는 덮어쓰지 않으며,
보고서는 새 `회계보고서` 시트에 만듭니다. 같은 이름이 있으면
`회계보고서 (2)`, `회계보고서 (3)`처럼 비어 있는 다음 이름을 사용합니다. 모든
워크북 쓰기는 기존 작업창의 [허용] / [항상 허용] 승인 절차를 그대로 거칩니다.

설치된 사이드카의 `config.json`에는 다음 에디션 설정이 기록됩니다.

```json
{
  "edition": "global",
  "profileCatalogPath": "profiles/product-profiles.json",
  "enabledGlobalTools": ["accounting-report"]
}
```

Standard에서는 `edition`이 `standard`이고 `enabledGlobalTools`는 빈 배열입니다.
`profileCatalogPath`는 `config.json`을 기준으로 해석됩니다. 제품 프로필 카탈로그는
`profiles/product-profiles.json`이며, 향후 Global 전용 전문 에이전트는 이 카탈로그에
새 `globalTools` 항목으로 추가하고 기본 활성화가 필요하면 Global 에디션의
`defaultGlobalTools` 배열에 해당 ID를 추가합니다.

`deploy/`, 오프라인 zip, 데모 통합 문서 및 실행 중 생성된 보고서는 모두 빌드 또는
런타임 산출물입니다. 이 저장소에는 저장하거나 Git에 커밋하지 않습니다.

## 주의 (IE11 / Excel 2016)

- 작업창 코드는 **ES5**로 다운레벨됩니다(esbuild → swc → es-check 게이트).
  `tsconfig.taskpane.json`의 lib이 ES5로 제한되어 최신 API 사용 시 typecheck에서 걸립니다.
- office.js는 CDN이 아닌 `web/assets/office/`에서 로컬 서빙됩니다.
- Fabric CSS는 원격 폰트 @font-face를 제거한 사본을 사용합니다(외부 요청 0건).

## `fillDown` 수식 최적화

여러 행에 같은 패턴의 수식을 채울 때 `excel_set_formulas`에 첫 행 수식과
`fillDown: true`를 전달할 수 있습니다. 이 옵션은
명시적인 복수 행 범위에서만 유효하며, 생략하면 기존 2차원 수식
배열 동작을 그대로 유지합니다.

`fillDown` 최적화는 Office.js `Range.autoFill` 기능이 있는 **ExcelApi 1.9
이상**에서만 사용합니다. Excel 2016/기본 ExcelApi 1.1 호스트에서는
추가 기능 자체는 계속 동작하지만 `fillDown` 요청은 작업장을 변경하기 전에
명확한 오류로 거부됩니다. 이 경우 `fillDown`을 생략하고 기존 전체 2차원
수식 배열을 전달하십시오.
