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
  있습니다. 성능 측정 원시 프레임과 해시는 `artifacts/addin-performance/`에 보존됩니다.

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

## 주의 (IE11 / Excel 2016)

- 작업창 코드는 **ES5**로 다운레벨됩니다(esbuild → swc → es-check 게이트).
  `tsconfig.taskpane.json`의 lib이 ES5로 제한되어 최신 API 사용 시 typecheck에서 걸립니다.
- office.js는 CDN이 아닌 `web/assets/office/`에서 로컬 서빙됩니다.
- Fabric CSS는 원격 폰트 @font-face를 제거한 사본을 사용합니다(외부 요청 0건).

## 50초 법인카드 자동 점검 시연

시연 파일 `법인카드-자동점검-시연.xlsx`에는 36건의 원천자료와 비어 있는
`자동화결과` 시트가 포함되어 있습니다. 시연자는 먼저 `원천자료`의 데이터를
보여 준 뒤 짧은 프롬프트를 붙여넣고 **보내기**와 동시에 초시계를 시작합니다.
도구 활동이 시작되면 `자동화결과`로 전환하고, 응답에 `완료`가 표시될 때
초시계를 멈춥니다.

소형 모델의 수식 JSON 직렬화를 줄이기 위해 시연 프롬프트는
`J2:J37`과 `B10:C13`에 첫 행 수식만 전달하고
`excel_set_formulas` `fillDown: true`를 사용하도록 명시합니다. 이 옵션은
명시적인 복수 행 범위에서만 유효하며, 생략하면 기존 2차원 수식
배열 동작을 그대로 유지합니다.

`fillDown` 최적화는 Office.js `Range.autoFill` 기능이 있는 **ExcelApi 1.9
이상**에서만 사용합니다. Excel 2016/기본 ExcelApi 1.1 호스트에서는
추가 기능 자체는 계속 동작하지만 `fillDown` 요청은 작업장을 변경하기 전에
명확한 오류로 거부됩니다. 이 경우 `fillDown`을 생략하고 기존 전체 2차원
수식 배열을 전달하십시오.

이 저장소에서 기록한 로컬 결과는 설치된 **GLM 연결의 진단 근거**일 뿐이며
Qwen3.6 35B의 처리 시간을 입증하지 않습니다. 실제 행사 전에 Qwen 환경에서
동일한 파일과 프롬프트로 반드시 한 번 더 실행하여 50초 제한을 확인하십시오.
GLM이 50초 안에 전체 수식 작성을 끝내지 못하면 시연을 강행하지 말고,
아티팩트 README에 기록된 진단 결과와 후속 최적화 항목을 확인하십시오.
