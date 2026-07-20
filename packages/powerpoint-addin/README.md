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
- Markdown, 텍스트, CSV, JSON, YAML, XML, 소스 코드 및 보고서 템플릿 PPTX를 선택할 수 있습니다.
- 선택한 파일은 `@tasks.md`처럼 입력창에 표시됩니다.
- 파일 내용은 브라우저에서 읽혀 인증된 localhost WebSocket으로만 전달되고,
  사이드카가 실제 AI 사용자 프롬프트 컨텍스트에 포함합니다.
- 텍스트 파일은 파일당 256KB, 메시지당 5개, 전체 512KB 제한입니다. 템플릿 PPTX는
  한 개만 첨부할 수 있으며 최대 10MiB입니다.
- `ask_user_question`은 전용 선택/직접입력 대화상자로 표시되며 답변이 에이전트
  도구 실행으로 반환됩니다.

## 책임자 제출용 PPTX

Markdown 회의록을 첨부하고 `/report @회의록.md`를 보내면 A4 세로형 PPTX를
생성합니다. 이 경로는 LLM 응답에 의존하지 않고 고정 Markdown 파서와 Windows
PowerPoint COM을 사용하므로 소형 모델에서도 보고서 구조가 달라지지 않습니다.

- 3쪽 구성: 회의 개요, 결정/실행 과제, 위험/다음 일정
- 모든 텍스트에 `원신한` 적용(미설치 시 생성 전에 명시적으로 실패)
- 생성 경로를 Add-in 작업 폴더 아래로 제한하고, 저장 후 PowerPoint로 재열어 검증
- 결과물은 `workspace\reports\*.pptx`에 저장

대상 PC에는 PowerPoint와 Windows PowerShell 5.1만 필요합니다. Python이나 시스템
Node.js를 추가 설치할 필요가 없으며, Node.js 런타임은 오프라인 ZIP에 포함됩니다.

세션 연결 시 CLI를 미리 시작하며 `query_spawn_started`, `cli_initialized`,
`user_message_enqueued`, `first_delta_received`, `artifact_saved` 성능 이벤트를
sidecar 프로토콜로 기록할 수 있습니다.

## 가변 템플릿 보고서 시연

한 페이지 A4 세로형 제출 양식 PPTX와 줄글 회의록을 한 번에 보내면 `/template-report`
경로가 템플릿의 제목, 날짜, 부서, 세 개 중제목, 표, 본문과 페이지 번호를 의미 기반으로
찾아 1~3페이지 보고서를 생성합니다. 작은 위치 변경이나 플레이스홀더 문구 변경에도 고정
도형 ID를 사용하지 않으며, 각 추가 페이지는 원본 템플릿 슬라이드를 복제합니다.

시연 순서:

1. 시간 측정 전에 실제 행사장의 `template.pptx`를 첨부해 둡니다.
2. `artifacts/addin-demo/2026-07-20/powerpoint/medium.txt`를 Markdown 표나 제목 없이
   줄글 그대로 붙여넣습니다.
3. `/template-report`를 실행하고 **보내기 버튼을 누르는 순간** 스톱워치를 시작합니다.
4. 작업 활동을 보여 준 뒤 저장된 PPTX를 열어 회사 머리글·바닥글이 두 페이지에 반복되고,
   두 번째 페이지가 자동 생성된 점을 확인합니다.

이 PC의 측정은 GLM 연결을 사용한 대리 검증일 뿐 Qwen3.6 35B 성능을 증명하지 않습니다.
행사 전 동일한 `medium.txt`와 실제 템플릿을 Qwen3.6 35B에서 최소 한 번 실행해 50초
이내 생성과 2페이지 결과를 별도로 확인해야 합니다.

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
