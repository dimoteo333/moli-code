<div align="center">

**내 터미널 안에 살아 숨쉬는 오픈소스 AI 에이전트**

</div>

**몰리 코드(Moli Code)** 는 터미널에 최적화된 오픈소스 AI 에이전트입니다. 대규모 코드베이스를 이해하고, 반복적인 작업을 자동화하며, 더 빠른 개발을 할 수 있도록 돕습니다.

![](https://gw.alicdn.com/imgextra/i1/O1CN01D2DviS1wwtEtMwIzJ_!!6000000006373-2-tps-1600-900.png)

## 몰리 코드를 선택해야 하는 이유

- **다양한 프로토콜 및 사내 연동**: OpenAI / Anthropic / Gemini 호환 API를 사용하거나, 사내 **몰리메이트(Molimate)** 인증을 통해 사용할 수 있습니다.
- **오픈소스 기반**: 프레임워크와 주요 에이전트 시스템이 함께 발전하는 생태계를 지향합니다.
- **에이전트 워크플로우**: 스킬(Skills) 및 서브에이전트(SubAgents) 등 내장 도구를 통해 다채로운 AI 에이전트 워크플로우를 제공합니다.
- **터미널 중심, IDE 친화적**: 커맨드 라인을 주로 사용하는 개발자를 위해 만들어졌으며, VS Code, Zed, JetBrains IDE 등과의 통합도 지원합니다.
- **한국어 완벽 지원**: CLI UI 전체를 한국어로 부드럽고 자연스럽게 번역하여 제공합니다.

---

## 설치 방법

### 빠른 설치 (권장)

#### Linux / macOS

```bash
curl -fsSL https://moli-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-moli.sh | bash
```

#### Windows (관리자 권한으로 CMD 실행)

```cmd
curl -fsSL -o %TEMP%\install-moli.bat https://moli-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-moli.bat && %TEMP%\install-moli.bat
```

> **참고**: 터미널의 환경 변수 적용을 위해 설치 후 터미널을 다시 시작하는 것을 권장합니다.

### 수동 설치

#### 필수 조건

Node.js 20 이상 버전을 설치해야 합니다. [nodejs.org](https://nodejs.org/en/download)에서 다운로드하세요.

#### NPM

```bash
npm install -g @moli-code/moli-code@latest
```

#### Homebrew (macOS, Linux)

```bash
brew install moli-code
```

---

## 시작하기

```bash
# 몰리 코드 실행 (대화형 모드)
moli

# 실행 후 세션 내에서:
/help
/auth
```

처음 사용 시 로그인/인증을 설정하라는 메시지가 표시됩니다. 언제든지 `/auth` 명령어를 실행하여 **몰리메이트(Molimate) 인증** 또는 **로컬 환경(Local Environment) 구성** 옵션을 통해 인증 방식을 전환할 수 있습니다.

**프롬프트 예시:**

```text
이 프로젝트는 어떤 역할을 하나요?
코드베이스 구조를 자세하게 설명해줘.
이 함수를 리팩토링하는 것을 도와줘.
이 모듈에 대한 단위 테스트(Unit test)를 생성해줘.
```

---

## 인증 (Authentication)

몰리 코드는 크게 두 가지 인증 방식을 지원합니다:

- **몰리메이트(Molimate) 인증 (권장)**: 사번을 입력하여 간편하게 연동하고 인증할 수 있는 사내 지원 방식입니다.
- **로컬 환경(Local Environment / API-KEY)**: 사용자가 직접 외부 API 엔드포인트와 모델명을 설정하여 사용할 수 있는 환경입니다.

### 몰리메이트 인증 (Molimate)

`moli` 명령어를 실행한 뒤, 프롬프트에서 인증 메뉴를 호출합니다:

```bash
/auth
```

메뉴에서 **"Authenticate with Molimate (몰리메이트로 인증)"**를 선택하고, 사번(영문/숫자 혼합)을 입력하여 손쉽게 인증을 완료할 수 있습니다.

### 로컬 환경 구성 (API-KEY 기반)

원하는 외부 모델(OpenAI, Anthropic, 별도의 커스텀 API 등)을 사용하고 싶다면, "Run in Local Environment" 옵션을 선택하세요.
API 엔드포인트와 모델명을 설정하면 `~/.moli/settings.json` 파일이 자동으로 구성됩니다.

직접 파일을 수정하여 세부 설정을 변경할 수도 있습니다.

##### `settings.json` 커스텀 설정 예시

```json
{
  "modelProviders": {
    "openai": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "envKey": "OPENAI_API_KEY",
        "baseUrl": "https://api.openai.com/v1"
      }
    ],
    "anthropic": [
      {
        "id": "claude-sonnet-4-20250514",
        "name": "Claude Sonnet 4",
        "envKey": "ANTHROPIC_API_KEY"
      }
    ]
  },
  "env": {
    "OPENAI_API_KEY": "sk-...",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  },
  "security": {
    "auth": {
      "selectedType": "openai"
    }
  },
  "model": {
    "name": "gpt-4o"
  }
}
```

> **보안 주의사항:** 버전 관리 시스템(Git 등)에 절대로 API 키를 커밋하지 마세요. `~/.moli/settings.json` 파일은 반드시 로컬에 안전하게 보관해야 합니다.

---

## 사용법

터미널 에이전트로서 주로 4가지 주요 사용 방식을 지원합니다:

1. **대화형 모드 (Terminal UI)**
2. **헤드리스(Headless) 모드 (스크립트/자동화용)**
3. **IDE 통합 (VS Code, Zed 등)**
4. **TypeScript SDK 활용**

### 대화형 모드 (Interactive Mode)

프로젝트 폴더에서 `moli`를 실행하면 몰리 코드 인터페이스가 열립니다. `@` 기호를 사용하여 로컬 경로의 파일/폴더를 컨텍스트로 쉽게 참조할 수 있습니다. (예: `@src/index.ts`)

```bash
cd your-project/
moli
```

### 헤드리스 모드 (Headless Mode)

인터랙티브 UI 없이 단일 입력에 대한 결과만 주고받으려면 `-p` 플래그를 사용하세요. CI/CD 파이프라인이나 스크립트 작성에 유용합니다.

```bash
cd your-project/
moli -p "방금 수정한 코드를 리뷰하고 요약해줘."
```

---

## 주요 명령어 및 단축키

### 세션 명령어 (슬래시 커맨드)

- `/help` - 사용 가능한 전체 명령어와 단축키 도움말을 표시합니다.
- `/auth` - 몰리메이트 로그인을 포함한 인증 방법을 변경합니다.
- `/clear` - 현재의 대화 기록과 컨텍스트를 비우고 세션을 리셋합니다.
- `/compress` - 토큰 절약을 위해 이전 대화 기록을 요약하여 압축합니다.
- `/stats` - 현재 세션의 모델 사용량, 속도 등 상세 통계를 확인합니다.
- `/bug` - 버그 발생 시 관련 로그를 간편하게 리포트합니다.
- `/exit` 또는 `/quit` - 몰리 코드를 종료합니다.

### 키보드 단축키

- `Ctrl+C` - 현재 실행 중인 작업을 취소합니다.
- `Ctrl+D` - 입력창이 비어있을 때 몰리 코드를 종료합니다.
- `↑ / ↓ (화살표 윗/아래 키)` - 기존에 입력했던 프롬프트 및 시스템 명령어 기록을 탐색합니다.
- `Shift+Tab` 또는 `Tab` - 도구 승인 자동 모드(Approval Mode)를 토글합니다.

> **💡 추가 팁**: 몰리 코드 내에서 `!` 문자로 시작하면 일반 셸(Shell) 명령어(`!npm run build`, `!ls -al` 등)를 그대로 실행할 수 있습니다.

---

## 설정 파일 (Configuration)

몰리 코드는 주로 아래 두 위치에서 설정 파일을 읽고 우선순위에 따라 덮어씌웁니다.

| 파일 위치 | 적용 범위 | 설명 |
| --- | --- | --- |
| `~/.moli/settings.json` | 사용자 (User) | 유저의 모든 몰리 코드 세션에 적용됩니다. **API 키 및 기본 환경 설정에 적합합니다.** |
| `.moli/settings.json` | 프로젝트 (Workspace) | 특정 프로젝트 내장 설정으로, 전역 사용자 설정보다 우선순위가 높습니다. |

---

## 문제 해결 (Troubleshooting)

사용 중 예기치 못한 문제가 발생했다면, CLI 창에서 `/bug` 명령어를 입력하세요.
에이전트에게 현재 오류 상황을 바로 분석해 달라고 요청할 수도 있습니다.

## 감사의 글

이 프로젝트는 [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)에 기반을 두고 있습니다. 훌륭한 CLI 구조를 제공해 주신 팀에게 감사드립니다. 몰리 코드는 이를 바탕으로 몰리메이트 인증 시스템, 커스텀 LLM 프로바이더 연동, 한국어 지원 등 내부 사정에 특화된 기능을 파서 레벨에서부터 추가/개선하였습니다.
