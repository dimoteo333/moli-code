# 몰리 코드 Eclipse 컴패니언 (Moli Code Eclipse Companion)

레거시 Windows 개발 환경(Eclipse 3.2.2 ~ 4.7.3)에서 **몰리 코드 CLI**와
Eclipse를 연동하는 경량 플러그인입니다.

## 기능

- **IDE 컨텍스트 공유** — 열려 있는 편집기 목록, 활성 파일, 커서 위치,
  선택한 텍스트를 몰리 코드 CLI에 실시간으로 전달합니다. CLI는 이 정보를
  바탕으로 현재 작업 중인 파일을 읽고 수정할 수 있습니다.
- **CVS 액션** — 메인 메뉴(`몰리 코드`)와 리소스 우클릭 메뉴에서 CVS
  명령을 바로 실행합니다:
  - `CVS 변경 확인 (diff)` — `cvs diff -u`
  - `CVS 업데이트 (update)` — `cvs update -d -P` (완료 후 워크스페이스 자동 새로고침)
  - `CVS 커밋 (commit)...` — 커밋 메시지 입력 후 `cvs commit -m <메시지>`
  - 출력은 `몰리 코드 CVS` 콘솔에 표시됩니다 (CP949 등 플랫폼 인코딩 그대로 처리).
- **몰리 코드 연결 상태** — 서버 포트/잠금 파일/연결된 CLI 수 확인.

## 요구 사항

| 항목    | 조건                                                          |
| ------- | ------------------------------------------------------------- |
| Eclipse | 3.2.2 ~ 4.7.3 (그 이후 버전도 actionSets가 유지되는 한 동작)  |
| JVM     | J2SE 1.4 이상 (소스가 1.4 문법으로 작성됨)                    |
| CVS     | `cvs` 클라이언트(CVSNT 등)가 PATH에 있어야 CVS 액션 사용 가능 |

## 빌드

JDK 8 이하(또는 `-source 1.4`를 지원하는 JDK)와 Ant가 필요합니다:

```bash
ant -Declipse.home=C:/eclipse jar
# 최신 JDK에서 빌드할 때 (문법은 동일하게 1.4 수준):
ant -Declipse.home=C:/eclipse -Dsource.level=7 -Dtarget.level=7 jar
```

`dist/com.moli.code.eclipse.companion_0.1.0.jar`가 생성됩니다.
PDE가 있는 Eclipse에서는 이 디렉터리를 플러그인 프로젝트로 임포트해서
`Export > Deployable plug-ins`로 빌드해도 됩니다.

## 설치

- **Eclipse 3.2.2**: jar를 `<eclipse>/plugins/`에 복사 후 `eclipse -clean`으로 재시작
- **Eclipse 4.7.3**: jar를 `<eclipse>/dropins/`에 복사 후 재시작

## 몰리 코드 CLI 연동 방법

1. Eclipse를 시작하면 플러그인이 `127.0.0.1`의 임의 포트에 컴패니언 서버를
   띄우고 `~/.moli/ide/<포트>.lock` 잠금 파일을 기록합니다.
2. Eclipse 워크스페이스(또는 열려 있는 프로젝트) 하위 경로에서 터미널을
   열고 `moli-code`를 실행합니다.
3. CLI에서 `/ide enable`을 입력하면 잠금 파일을 통해 자동으로 연결됩니다.
   (Eclipse는 환경 변수 감지가 불가능하므로 잠금 파일의 `ideInfo`로 인식됩니다.)
4. 연결되면 CLI가 열려 있는 파일·커서·선택 영역을 실시간으로 인지합니다.

몰리 코드가 디스크에서 파일을 수정하면 Eclipse가 자동으로 반영하도록
`Window > Preferences > General > Workspace > Refresh automatically`를 켜는
것을 권장합니다 (3.2에서는 `Refresh workspace automatically`).

## 프로토콜 / 구조

```
Eclipse (플러그인)                          몰리 코드 CLI
┌──────────────────────────┐               ┌──────────────────┐
│ OpenFilesTracker         │               │ ide-client (MCP) │
│  └─ IdeServer (HTTP/SSE) │◄── /mcp ─────►│  StreamableHTTP  │
│ LockFileManager          │               └──────────────────┘
│  └─ ~/.moli/ide/<port>.lock  ← 포트/토큰/워크스페이스 경로 검색
│ CvsRunner + 액션          │ → cvs diff/update/commit (외부 프로세스)
└──────────────────────────┘
```

- MCP streamable-HTTP 중 CLI가 사용하는 부분만 구현: `initialize`,
  `tools/list`(빈 목록), `ping`, 알림 202 응답, GET SSE 스트림으로
  `ide/contextUpdate` 푸시, Bearer 토큰 인증.
- 외부 라이브러리 의존성 없음 — JSON 파서/HTTP 서버 모두 자체 구현
  (Java 1.4 호환).

## 제한 사항

- IDE 내 diff 승인 UI(`openDiff`/`closeDiff` 도구)는 제공하지 않습니다.
  편집 검토는 CLI에서 이루어지며, 이는 도구 목록이 비어 있으면 CLI가
  자동으로 감지하는 정상 동작입니다.
- CVS 액션은 Eclipse Team CVS 대신 외부 `cvs` 클라이언트를 사용합니다.
  CLI 쪽 `cvs` 도구와 동일한 동작을 보장하기 위한 선택입니다.
