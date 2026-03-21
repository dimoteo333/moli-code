# 문제 해결

이 가이드는 자주 발생하는 문제에 대한 해결 방법과 디버깅 팁을 제공합니다.

- 인증 및 로그인 오류
- 자주 묻는 질문 (FAQ)
- 일반적인 오류 메시지 및 해결 방법
- IDE Companion 연결 문제
- 종료 코드
- 디버깅 팁

## 인증 및 로그인 오류

- **오류: `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, 또는 `unable to get local issuer certificate`**
  - **원인:** 방화벽이 SSL/TLS 트래픽을 가로채 검사하는 사내 네트워크 환경에서 발생할 수 있습니다. 이 경우 Node.js가 사내 루트 CA 인증서를 신뢰하도록 설정해야 합니다.
  - **해결:** `NODE_EXTRA_CA_CERTS` 환경변수를 사내 루트 CA 인증서 파일의 절대 경로로 설정하세요.
    - 예시: `export NODE_EXTRA_CA_CERTS=/path/to/your/corporate-ca.crt`

- **문제: 인증 실패 후 UI가 표시되지 않음**
  - **원인:** 인증 유형 선택 후 인증에 실패하면 `security.auth.selectedType` 설정이 `settings.json`에 저장될 수 있습니다. 재시작 시 CLI가 실패한 인증 유형으로 계속 시도하여 UI가 표시되지 않을 수 있습니다.
  - **해결:** `settings.json` 파일에서 `security.auth.selectedType` 항목을 제거하세요.
    - `~/.moli/settings.json` (또는 프로젝트별 설정인 `./.moli/settings.json`) 파일을 엽니다.
    - `security.auth.selectedType` 항목을 삭제합니다.
    - CLI를 재시작하면 인증을 다시 선택할 수 있습니다.

## 자주 묻는 질문 (FAQ)

- **Q: 몰리 코드를 최신 버전으로 업데이트하려면 어떻게 하나요?**
  - A: http://molicode.vercel.app 및 https://github.com/dimoteo333/moli-code를 참조해주세요.

- **Q: 몰리 코드 설정 파일은 어디에 저장되나요?**
  - A: 몰리 코드 설정은 두 개의 `settings.json` 파일에 저장됩니다.
    1. 홈 디렉토리: `~/.moli/settings.json`
    2. 프로젝트 루트 디렉토리: `./.moli/settings.json`

    자세한 내용은 [몰리 코드 설정](../configuration/settings) 문서를 참고하세요.

- **Q: 통계 출력에서 캐시된 토큰 수가 보이지 않는 이유는 무엇인가요?**
  - A: 캐시된 토큰 정보는 캐시된 토큰이 실제로 사용되는 경우에만 표시됩니다. 이 기능은 API 키 사용자(API 키 또는 Google Cloud Vertex AI)에게 제공되며, OAuth 사용자(Google 개인/기업 계정 등)에게는 제공되지 않습니다. 몰리 코드 Assist API는 캐시된 콘텐츠 생성을 지원하지 않기 때문입니다. `/stats` 명령어로 전체 토큰 사용량은 확인할 수 있습니다.

## 일반적인 오류 메시지 및 해결 방법

- **오류: MCP 서버 시작 시 `EADDRINUSE` (주소 이미 사용 중)**
  - **원인:** MCP 서버가 바인딩하려는 포트를 다른 프로세스가 이미 사용 중입니다.
  - **해결:** 해당 포트를 사용 중인 다른 프로세스를 중지하거나, MCP 서버를 다른 포트로 설정하세요.

- **오류: `moli-code` 실행 시 Command not found**
  - **원인:** CLI가 올바르게 설치되지 않았거나 시스템 `PATH`에 포함되지 않았습니다.
  - **해결:** 설치 방법에 따라 다릅니다.
    - `moli-code`를 전역 설치한 경우, `npm` 전역 바이너리 디렉토리가 `PATH`에 있는지 확인하세요. `npm install -g @dobby/moli-code@latest`로 업데이트할 수 있습니다.
    - 소스에서 직접 실행하는 경우, 올바른 명령어(예: `node packages/cli/dist/index.js ...`)를 사용하고 있는지 확인하세요. 최신 변경 사항을 pull한 후 `npm run build`로 다시 빌드하세요.

- **오류: `MODULE_NOT_FOUND` 또는 import 오류**
  - **원인:** 의존성이 올바르게 설치되지 않았거나, 프로젝트가 빌드되지 않았습니다.
  - **해결:**
    1. `npm install`을 실행하여 모든 의존성을 설치합니다.
    2. `npm run build`를 실행하여 프로젝트를 컴파일합니다.
    3. `npm run start`로 빌드가 정상적으로 완료되었는지 확인합니다.

- **오류: "Operation not permitted", "Permission denied" 등 권한 관련 오류**
  - **원인:** 샌드박싱이 활성화된 경우, 몰리 코드가 샌드박스 설정에 의해 제한된 작업(예: 프로젝트 디렉토리 또는 시스템 임시 디렉토리 외부에 쓰기)을 시도할 수 있습니다.
  - **해결:** [설정: 샌드박싱](../features/sandbox) 문서에서 샌드박스 설정 커스터마이징 방법을 확인하세요.

- **"CI" 환경에서 몰리 코드가 대화형 모드로 실행되지 않는 경우**
  - **문제:** `CI_`로 시작하는 환경변수(예: `CI_TOKEN`)가 설정되어 있으면 대화형 모드로 진입하지 않습니다 (프롬프트가 표시되지 않음).
  - **원인:** 기반 UI 프레임워크에서 사용하는 `is-in-ci` 패키지가 `CI`, `CONTINUOUS_INTEGRATION`, 또는 `CI_` 접두사가 붙은 환경변수를 감지하면 비대화형 CI 환경으로 판단합니다.
  - **해결:** 해당 `CI_` 접두사 변수가 CLI 동작에 필요하지 않다면, 명령어 실행 시 임시로 해제하세요. 예: `env -u CI_TOKEN moli-code`

- **프로젝트 .env 파일에서 DEBUG 모드가 작동하지 않는 경우**
  - **문제:** 프로젝트의 `.env` 파일에서 `DEBUG=true`를 설정해도 CLI의 디버그 모드가 활성화되지 않습니다.
  - **원인:** `DEBUG` 및 `DEBUG_MODE` 변수는 CLI 동작에 간섭하는 것을 방지하기 위해 프로젝트 `.env` 파일에서 자동으로 제외됩니다.
  - **해결:** `.moli/.env` 파일을 사용하거나, `settings.json`의 `advanced.excludedEnvVars` 설정에서 제외 변수를 조정하세요.

## IDE Companion 연결 문제

- VS Code에서 단일 워크스페이스 폴더가 열려 있는지 확인하세요.
- 확장 프로그램 설치 후 통합 터미널을 재시작하여 다음 환경변수가 상속되도록 하세요.
  - `MOLI_CODE_IDE_WORKSPACE_PATH`
  - `MOLI_CODE_IDE_SERVER_PORT`
- 컨테이너에서 실행 중인 경우, `host.docker.internal`이 정상적으로 resolve 되는지 확인하세요. 그렇지 않으면 호스트를 적절히 매핑하세요.
- `/ide install`로 Companion을 재설치하고, 명령 팔레트에서 "Moli Code: Run"을 실행하여 정상 구동을 확인하세요.

## 종료 코드

몰리 코드는 종료 원인을 나타내기 위해 특정 종료 코드를 사용합니다. 스크립트 작성 및 자동화에 유용합니다.

| 종료 코드 | 오류 유형                  | 설명                                                                   |
| --------- | -------------------------- | ---------------------------------------------------------------------- |
| 41        | `FatalAuthenticationError` | 인증 과정에서 오류가 발생했습니다.                                     |
| 42        | `FatalInputError`          | 유효하지 않거나 누락된 입력이 제공되었습니다. (비대화형 모드 전용)     |
| 44        | `FatalSandboxError`        | 샌드박싱 환경(Docker, Podman, Seatbelt 등)에서 오류가 발생했습니다.    |
| 52        | `FatalConfigError`         | 설정 파일(`settings.json`)이 유효하지 않거나 오류를 포함하고 있습니다. |
| 53        | `FatalTurnLimitedError`    | 세션의 최대 대화 턴 수에 도달했습니다. (비대화형 모드 전용)            |

## 디버깅 팁

- **CLI 디버깅:**
  - CLI 명령어에 `--verbose` 플래그(사용 가능한 경우)를 추가하여 더 자세한 출력을 확인하세요.
  - CLI 로그를 확인하세요. 로그는 보통 사용자별 설정 또는 캐시 디렉토리에 저장됩니다.

- **Core 디버깅:**
  - 서버 콘솔 출력에서 오류 메시지나 스택 트레이스를 확인하세요.
  - 설정 가능한 경우 로그 상세 수준을 높이세요.
  - 서버 측 코드를 단계별로 추적해야 하는 경우 Node.js 디버깅 도구(예: `node --inspect`)를 사용하세요.

- **도구 관련 문제:**
  - 특정 도구에서 오류가 발생하면, 해당 도구가 수행하는 명령이나 작업의 가장 단순한 버전을 실행하여 문제를 격리하세요.
  - `run_shell_command`의 경우, 해당 명령어가 셸에서 직접 실행될 때 정상 작동하는지 먼저 확인하세요.
  - 파일 시스템 도구의 경우, 경로가 올바른지 그리고 권한을 확인하세요.

- **사전 점검:**
  - 코드를 커밋하기 전에 항상 `npm run preflight`를 실행하세요. 포맷팅, 린팅, 타입 오류 등 자주 발생하는 문제를 미리 잡을 수 있습니다.

## 기존 GitHub 이슈 검색 및 새 이슈 생성

이 문제 해결 가이드에서 다루지 않은 문제가 발생한 경우, 몰리 코드 [GitHub 이슈 트래커](https://github.com/dimoteo333/moli-code/issues)에서 유사한 이슈를 검색해 보세요. 유사한 이슈를 찾을 수 없다면 상세한 설명과 함께 새 GitHub 이슈를 생성해 주세요. Pull Request도 환영합니다!
