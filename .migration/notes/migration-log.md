# Migration Log: v0.12.5 → v0.14.3

## Phase 1: 준비 ✅
- `.migration/` 프레임워크 생성
- 16개 카테고리별 패치 추출
- `rebrand-v2.sh` 자동화 스크립트 작성
- 업스트림 v0.14.3 소스 확보

## Phase 2: 브랜딩 ✅
- `rebrand-v2.sh`로 전체 리브랜딩 (13단계)
- 패키지명: `@qwen-code/*` → `@dobby/moli-code-*`
- 설정경로: `.qwen` → `.moli`
- 표시명: `Qwen Code` → `Moli Code`
- Auth: `QWEN_OAUTH` → `MOLI_OAUTH`
- URL: `github.com/QwenLM` → `github.com/dimoteo333`

### 브랜딩 부작용 수정 (빌드 수정)
sed의 `.qwen → .moli` 치환이 변수명도 바꿔버림:
- `qwenDir` → `moliDir` (선언/사용 통일)
- `qwenClient` → `moliClient` (선언/사용 통일)
- `qwenIgnoreFilter` → `moliIgnoreFilter` (선언/사용 통일)
- `.tsx` 파일에 `QWEN_OAUTH` 잔여 → 수동 수정
- `useQwenAuth` 파일명은 유지하면서 import 경로 수정
- `build.mjs` 파일에 `@qwen-code/webui` 잔여 → 수정

**향후 브랜딩 시 주의:**
1. `.tsx`, `.mjs` 파일도 포함해야 함
2. `qwen*` 변수/클래스명은 바꾸지 않는 것이 좋음 (내부 API)
3. `.qwen` 경로 치환 시 `qwen*` 변수명에 영향 주지 않도록 단어 경계(`\b`) 사용 검토

## Phase 3: 인증 시스템 ✅
- v0.14.3의 `packages/core/src/qwen/` OAuth 모듈이 이미 브랜딩됨
- 디렉토리명만 `qwen/` → `moli/` 변경
- import 경로 업데이트
- **기존 v0.12.5의 커스텀 moli 모듈과 동일** — 추가 작업 불필요

## Phase 4: 커스텀 모델 ✅
- Upstage Solar Pro3 토큰 리미트 추가
  - Input: solar-pro3=128k, solar=128k
  - Output: solar-pro3=64k, solar=16k

## Phase 5: 프롬프트/i18n ✅
- 민감 키워드 우회 가이드라인 추가 (방화벽→보안 규칙 등)
- ko-KR 언어 지원 추가
- ko.js 로케일 파일 복사

## Phase 6: SEA 빌드 ✅
- `sea-config.json` 복사
- `build_sea.sh`, `build_offline.sh`, `prepare-offline-dev.sh` 복사
- `httpsAgent.ts` (Windows 인증서 주입) 복사

## Phase 7: 테스트 ✅
- `npm run build` 성공
- `npm run bundle` 성공
- TypeScript 컴파일 에러 0 (packages/core, packages/cli)
- lint-staged (prettier + eslint) 통과

## Git Log (moli-code-clean)
```
base: qwen-code v0.14.3 clean source
branding: rebrand qwen-code → moli-code (v0.14.3 base)
refactor: rename qwen/ → moli/ module directory
feat(models): add Upstage Solar Pro3 token limits
feat(prompts,i18n): add custom prompt guidelines + Korean locale
feat(build): add SEA build scripts + Windows certificate injection
fix(build): resolve branding side-effects in TypeScript compilation
```

## 향후 버전 업그레이드 절차
1. 새 버전 클론 → `.migration/upstream-vX.Y.Z`
2. `rebrand-v2.sh apply` 실행
3. `.tsx`, `.mjs` 잔여 확인
4. 변수명 과도 치환 (`qwen* → moli*`) 검사
5. `moli/` 디렉토리 rename
6. 커스텀 모델/프롬프트/i18n 재적용
7. 빌드 + 테스트
