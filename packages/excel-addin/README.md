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
