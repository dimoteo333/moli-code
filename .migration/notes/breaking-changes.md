# Breaking Changes: v0.12.5 → v0.14.3

## 구조 변경 (Branding 마이그레이션 시 참고)

### 새로운 패키지/모듈
- `packages/channels/` — Channels 플랫폼 (Telegram/WeChat/DingTalk)
- `packages/core/src/hooks/` — Hooks 시스템 (10개 이벤트)
- `packages/core/src/followup/` — Follow-up 제안 시스템
- `packages/core/src/permissions/` — 권한 관리 모듈
- `packages/core/src/prompts/` — 프롬프트 모듈 분리
- `packages/core/src/qwen/` — Qwen 전용 모듈
- `packages/core/src/skills/` — Skills 시스템
- `packages/core/src/telemetry/` — Telemetry 모듈
- `packages/core/src/tools/cron-*.ts` — Cron 도구들

### Auth 변경
- `QWEN_OAUTH` → moli에서는 `MOLI_OAUTH`로 매핑 필요
- `AuthProviderType` enum 추가됨
- config.ts에 authProviderType 필드 추가

### Core API 변경
- `TaskTool` → `AgentTool` (subagents)
- `verboseMode` → `compactMode`
- `CoreToolScheduler`로 IDE diff 중앙 집중
- `MOLI_DIR` → 여전히 `storage.ts`에 정의

### 파일 위치 변경
- `prompts.ts` → `prompts/` 디렉토리로 분리 가능성
- i18n 구조 변경 여부 확인 필요

### Config 경로
- `.qwen/` → `.moli/` (브랜딩 시 자동 변환)
- `QWEN.md` → `AGENTS.md` (v0.13.0에서 변경)

## 마이그레이션 우선순위
1. 브랜딩 (rebrand.sh)
2. Config/Auth (MOLI_OAUTH → 새 AuthProviderType)
3. Custom modules (packages/core/src/moli/)
4. Prompts (필터 우회, 언어 가이드)
5. Models (Solar Pro3, 커스텀 토큰 리미트)
6. Build (SEA, Windows 인증서)
