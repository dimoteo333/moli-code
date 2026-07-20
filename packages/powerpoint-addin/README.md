# @dobby/moli-code-powerpoint-addin

폐쇄망 Windows PowerPoint 2016+에서 동작하는 몰리 코드 작업창 추가 기능입니다. 기존
Excel 추가 기능과 같은 localhost HTTPS/WebSocket 사이드카 및 SDK 세션 구조를
사용합니다.

```text
PowerPoint 작업창 (IE11/ES5, office.js 오프라인 번들)
   │  wss://localhost:39216/ws  (토큰 인증 WebSocket)
   ▼
사이드카 (Node, HTTPS 정적 서빙 + SDK 브리지)
   │  @dobby/moli-code-sdk query()  ← stream-json stdio
   ▼
moli-code CLI  ←→  사내 LLM 게이트웨이
```

## 파일 첨부

- 입력창의 `📌` 버튼을 누르면 Windows 파일 선택기가 열립니다.
- Markdown, 텍스트, CSV, JSON, YAML, XML 및 소스 코드 파일을 선택할 수 있습니다.
- 선택한 파일은 `@tasks.md`처럼 입력창에 표시됩니다.
- 파일 내용은 브라우저에서 읽혀 인증된 localhost WebSocket으로만 전달되고,
  사이드카가 실제 AI 사용자 프롬프트 컨텍스트에 포함합니다.
- 파일당 256KB, 메시지당 5개, 전체 512KB 제한입니다. 바이너리 파일은 거부합니다.
- `ask_user_question`은 전용 선택/직접입력 대화상자로 표시되며 답변이 에이전트
  도구 실행으로 반환됩니다.

## 개발

```bash
npm run build --workspace=packages/powerpoint-addin
npm test --workspace=packages/powerpoint-addin
npm run dev --workspace=packages/powerpoint-addin
# https://localhost:39216/taskpane.html?mock=1
```

작업창은 ES5로 다운레벨한 뒤 `es-check`를 통과해야 하며, `office.js`와 Fabric CSS는
CDN 대신 배포 폴더에 포함됩니다.

## 폐쇄망 배포 ZIP

```bash
npm run package:deploy --workspace=packages/powerpoint-addin
# packages/powerpoint-addin/moli-powerpoint-addin-0.5.0-offline.zip
```

ZIP에는 Windows `node.exe`, 몰리 코드 CLI 번들, Office.js, 설치/제거 스크립트,
PowerPoint 매니페스트가 들어 있어 대상 PC 설치 과정에는 인터넷이 필요 없습니다.
모델 호출은 대상 PC에 설정된 사내 LLM 게이트웨이를 사용합니다.
