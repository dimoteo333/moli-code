# moli-code v0.2.3 → v0.3.0 마이그레이션 진행 로그

**브랜치**: `upgrade/v0.14.3`
**원격**: `git@github.com:dimoteo333/moli-code.git`
**최종 커밋**: `2239115`

---

## 개요

Qwen Code v0.14.3 (오픈소스)를 fork하여 Moli Code v0.3.0으로 리브랜딩 + 커스텀 기능 통합.

---

## ✅ 완료된 작업

### Phase 1: 마이그레이션 인프라
- `.migration/` 프레임워크 생성
- 기존 커스텀 16개 카테고리별 패치 추출
- `rebrand-v2.sh` 자동 브랜딩 스크립트 작성

### Phase 2: 전면 브랜딩
| 항목 | 변경 |
|---|---|
| 패키지명 | `@qwen-code/*` → `@dobby/moli-code-*` |
| 설정경로 | `.qwen` → `.moli` |
| 표시명 | `Qwen Code` → `Moli Code` |
| 인증 enum | `QWEN_OAUTH` → `MOLI_OAUTH` |
| 환경변수 | `QWEN_SYSTEM_MD` → `MOLI_SYSTEM_MD` 등 |
| 명령어 | `qwen` → `moli` / `moli-code` |
| URL | `github.com/QwenLM` → `github.com/dimoteo333` |
| IDE 환경변수 | `QWEN_CODE_IDE_*` → `MOLI_CODE_IDE_*` |
| VSCode publisher | `qwenlm` → `molimate` |

### Phase 3: Molimate 인증 통합
- `packages/core/src/qwen/` → `moli/` rename
- `molimateAuthService.ts` 복원 (Employee ID 인증)
- `molimateConfig.ts` 복원 (원격 설정 로드)
- AuthDialog에 `MOLIMATE` 옵션 추가 (`molimate.config.json` 있을 때만 표시)
- `fetchRemoteMolimateConfig()` → employee ID 입력 → `authenticateWithMolimate()`

### Phase 4: 커스텀 모델
- Upstage Solar Pro3 토큰 리미트 추가 (input: 128k, output: 64k/16k)

### Phase 5: 프롬프트/i18n
- 민감 키워드 우회 가이드라인 추가 (방화벽→보안 규칙 등)
- ko-KR 언어 지원 + ko.js 로케일 파일
- en.js 1083키, ko.js 1058키, 중복 0, eslint 통과
- 브랜딩 누락 67개 문자열 수정

### Phase 6: 채널 비활성화
- CLI 명령어, tsconfig, build.js에서 채널 제외
- `--help`에 channel 명령어 미표시

### Phase 7: 빌드 스크립트
- `scripts/build_offline.sh` → `moli-code-0.3.0.tgz` (14MB)
- `scripts/build_vsix.sh` → `.vsix` (9.1MB, 오프라인)
- `scripts/build_sea.sh` → 단일 실행파일 (Windows)

### Phase 8: 테스트
| 패키지 | 결과 |
|---|---|
| core | 5366/5366 통과 (스냅샷 15개 업데이트) |
| cli | 3882/3882 통과 |
| vscode-ide-companion | 165/166 통과 (1 skip) |
| i18n eslint | 0 errors |

---

## 📁 주요 파일 위치

### 빌드 스크립트
- `scripts/build.js` — 전체 워크스페이스 빌드 (채널 제외)
- `scripts/build_offline.sh` — npm tarball 생성
- `scripts/build_vsix.sh` — VSCode VSIX 생성
- `scripts/build_sea.sh` — Node.js SEA 단일 실행파일
- `scripts/prepare-package.js` — dist/ 메타데이터 생성
- `scripts/copy_bundle_assets.js` — 번들 에셋 복사

### 커스텀 서비스
- `packages/cli/src/services/molimateAuthService.ts` — Employee ID 인증
- `packages/cli/src/constants/molimateConfig.ts` — 원격 설정 로드
- `packages/cli/src/utils/httpsAgent.ts` — Windows 인증서 주입

### 설정
- `package.offline.json` — 오프라인 배포용 package.json
- `packages/cli/molimate.config.example.json` — Molimate 설정 예시

---

## 🔧 선택적 개선 (향후 작업)

### 1. 통합 빌드 스크립트
`build_all.sh` 하나로 tgz + vsix + SEA 한 번에 생성.

### 2. install.sh
오프라인 배포 패키지용 통합 설치 스크립트:
```
moli-code-0.3.0-offline/
├── moli-code-0.3.0.tgz
├── moli-code-vscode-0.3.0.vsix
├── moli-code.exe          (옵션)
└── install.sh
```

### 3. 실제 연동 테스트
- VSCode에 VSIX 설치 후 CLI↔확장 통신 확인
- `moli auth` 실제 인증 흐름
- `moli -p "hello"` 모델 응답
- `moli mcp add` MCP 서버 연결

### 4. Windows SEA 빌드
- `build_sea.sh --windows` 실제 Windows에서 테스트
- 인증서 주입(httpsAgent) Windows 환경 검증

### 5. QWEN.md → MOLI.md
- 기본 컨텍스트 파일명 변경 (기존 사용자 breaking)
- 현재 `QWEN.md` + `AGENTS.md` 둘 다 지원 중
- 메이저 버전에서 전환 검토

### 6. rebrand-v2.sh v3
- 과도 치환 방지 패턴 개선 (Section 3, 16)
- 변수명 내부 qwen이 치환되지 않도록 string-literal-only 매칭

---

## ⚠️ 주의사항

### rebrand-v2.sh 사용 시
- Section 3 (`.qwen` → `.moli`)이 변수명 `qwenDir`까지 바꿀 수 있음
- Section 16 (`QWEN_OAUTH` → `MOLI_OAUTH`)이 `qwenOauthClient`까지 바꿀 수 있음
- **반드시 빌드 + 테스트로 검증 후 커밋**

### QWEN.md 파일명
- 파일명 그대로 유지 (기존 사용자 호환성)
- v0.14.3에서 `AGENTS.md`도 자동 인식

### VSIX 빌드 시
- `build_vsix.sh --prune-rg`로 현재 플랫폼만 포함 시 9.1MB
- 전체 플랫폼 포함 시 17MB
- `.vscodeignore`에 `src/`, `*.map` 명시 필요 (vsce가 git tracked 파일 포함)

### package.offline.json
- bin 필드 중복 주의 (`moli`와 `moli-code` 모두 등록)
- npm pack 전 JSON 유효성 검사 필요

---

## Git 로그

```
2239115 feat: add build_vsix.sh script for offline VSIX packaging
6e1f4d3 feat(vscode): build offline VSIX extension package
605d88e fix: rebrand-v2.sh over-replacement prevention + minor branding cleanup
e7ffef9 fix: i18n dedup + missing ko.js keys + test fixes
f3e6041 feat: disable channel commands + fix remaining branding
...     feat(auth): integrate Molimate employee ID auth into v0.14.3 AuthDialog
...     fix(branding): complete remaining Qwen Code → Moli Code rebranding
...     fix: CLI command name qwen → moli + package offline fixes
...     fix: restore molimateConfig + fix channel builds
...     chore: bump version to 0.3.0
...     fix: add missing env var branding + preserve molimateAuthService
...     feat: upgrade base from v0.12.5 to v0.14.3
...     docs(migration): add migration log and rebrand-v2.sh
...     chore(migration): Phase 1 — prepare migration infrastructure
```

---

## 추가 작업 (2026-04-13 19:00)

### ✅ XML Tool Call 파서 (main + v0.3.0 양쪽 적용)
- `packages/core/src/utils/xmlToolCallParser.ts` 신규
- `packages/core/src/core/openaiContentGenerator/converter.ts` 수정
- Qwen 모델이 XML 텍스트로 tool call 출력 시 자동 감지 + 파싱
- 16개 테스트 케이스 통과

### ✅ VSCode VSIX 연동 테스트
- `code --install-extension moli-code-vscode-ide-companion-0.3.0.vsix` 설치 성공
- 확장 ID: `molimate.moli-code-vscode-ide-companion@0.3.0`
- 내부 CLI: `dist/qwen-cli/cli.js` → `--version` → `0.3.0` 정상
- ripgrep (arm64-darwin), node-pty, clipboard 포함 확인
- extension.cjs.js (6.4MB) 정상 로드
- commands 9개 등록 확인 (Moli Code: Open, Login, New Conversation 등)
