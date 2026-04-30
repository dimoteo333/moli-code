# Moli Code Eclipse 플러그인

## 프로젝트 개요

Moli Code Eclipse 플러그인은 Eclipse IDE 안에서 Moli Code ACP 채팅을 실행하고, MCP 기반 IDE 통합 도구를 로컬 서버로 제공하는 플러그인입니다. 채팅 뷰는 ACP subprocess와 JSON-RPC로 통신하고, MCP 서버는 현재 workspace 컨텍스트와 diff 도구를 Moli Code 에이전트에 제공합니다.

## 아키텍처

이 프로젝트는 세 개의 Tycho 모듈로 구성됩니다.

- `com.moli.code.eclipse.core`: ACP 세션, MCP IDE 서버, workspace 컨텍스트, diff 서비스를 담당합니다.
- `com.moli.code.eclipse.ui`: 채팅 뷰, 명령 핸들러, 설정 페이지, diff 알림 팝업을 제공합니다.
- `com.moli.code.eclipse.feature`: Eclipse에 설치 가능한 feature 단위입니다.

ACP 채팅 흐름은 다음과 같습니다.

1. `MoliChatView`가 사용자 프롬프트를 `AcpSessionManager`로 전달합니다.
2. `AcpSessionManager`가 ACP subprocess와 session 수명을 관리합니다.
3. `MoliAcpClientService`가 `initialize`, `authenticate`, `session/new`, `session/prompt` JSON-RPC 요청을 순서대로 보냅니다.
4. ACP `session/update` 스트리밍 텍스트가 UI listener로 전달되어 채팅 뷰에 누적 표시됩니다.

MCP IDE 통합 흐름은 다음과 같습니다.

1. `Activator`가 workspace 시작 시 `MoliMcpIdeServer`를 시작합니다.
2. MCP 서버는 `127.0.0.1` 임의 포트의 `/mcp` 엔드포인트로 `initialize`, `tools/list`, `tools/call`을 처리합니다.
3. 서버 정보와 bearer token은 `~/.moli/ide/<port>.lock` 파일에 기록됩니다.
4. workspace/editor 변경은 `ide/contextUpdate` 및 `ide/workspaceChanged` 알림으로 연결된 SSE 클라이언트에 전달됩니다.
5. `openDiff`, `closeDiff` MCP 도구는 Eclipse Compare UI와 연동됩니다.

## 빌드 방법

필수 조건:

- Java 8
- Maven 3.9 이상
- 네트워크 접근 가능 환경
- Eclipse Oxygen p2 repository 접근 가능

빌드 명령:

```bash
cd packages/eclipse-plugin
mvn clean package -B
```

루트 `pom.xml`은 Tycho `1.7.0`을 사용하며 target platform은 `https://download.eclipse.org/releases/oxygen`입니다. 런타임 호환 범위는 Eclipse 3.2.2(Callisto)부터 Eclipse 4.7.3(Oxygen)까지를 목표로 합니다.

## 설치 방법

빌드가 끝나면 각 모듈의 `target` 디렉터리에 번들 및 feature 산출물이 생성됩니다.

대표 산출물:

- `com.moli.code.eclipse.core/target/com.moli.code.eclipse.core-0.1.0-SNAPSHOT.jar`
- `com.moli.code.eclipse.ui/target/com.moli.code.eclipse.ui-0.1.0-SNAPSHOT.jar`
- `com.moli.code.eclipse.feature/target/com.moli.code.eclipse.feature-0.1.0-SNAPSHOT.jar`

개발 중 빠른 설치:

1. Eclipse Oxygen에서는 `Help > Install New Software...` 또는 dropins 방식으로 빌드된 feature/plugin을 설치합니다.
2. Eclipse Callisto는 p2가 없으므로 빌드된 plugin JAR를 `plugins/` 또는 `dropins/` 방식으로 배치합니다.
3. Eclipse를 재시작합니다.

운영 배포에는 p2 update site 모듈을 추가해 repository zip을 만드는 방식을 권장합니다.

## 사용 방법

1. `Window > Preferences > Moli Code`에서 Node 실행 파일, Moli Code 디렉터리, 인증 방식을 설정합니다.
2. `Window > Show View > Other... > Moli Code > Moli Code`로 채팅 뷰를 엽니다.
3. 프롬프트를 입력하고 `Send`를 누릅니다.
4. ACP 응답은 채팅 뷰에 실시간으로 스트리밍됩니다.
5. 에이전트가 diff 도구를 호출하면 Eclipse Compare 에디터와 diff 알림 팝업이 열립니다.

## 개발 가이드

- Java 소스는 `src/` 아래에 두고, 번들 포함 리소스는 각 모듈의 `build.properties`에 추가합니다.
- OSGi 의존성이 필요하면 해당 번들의 `META-INF/MANIFEST.MF` `Require-Bundle` 또는 `Import-Package`를 먼저 갱신합니다.
- ACP 프로토콜 변경 시 `MoliAcpClientService`의 JSON-RPC 요청/응답 처리와 `ChatEventListener` 계약을 함께 확인합니다.
- MCP 도구를 추가할 때는 `McpToolHandler.toolsListResult()`와 `handleToolCall()`을 함께 수정합니다.
- workspace/editor 컨텍스트 변경은 `MoliContextService`와 `Activator`의 workspace listener에서 관리합니다.
- UI 코드는 SWT UI thread에서만 widget을 갱신해야 하며, background ACP 이벤트는 `Display.asyncExec`로 전달합니다.

## 검증

최종 검증 명령:

```bash
cd packages/eclipse-plugin
mvn clean package -B
```
