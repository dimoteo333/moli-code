# Migration: v0.12.5 → v0.14.3

## 개요
- **Base branch**: `main` (v0.12.5 기반 moli-code v0.2.3)
- **Target**: qwen-code v0.14.3 기반 moli-code
- **작업 브랜치**: `upgrade/v0.14.3`

## 확장성 원칙
향후 버전 업그레이드 시:
1. **커스텀 변경사항을 모듈화** — core 수정 최소화, plugins/hooks/skills 활용
2. **브랜딩 스크립트 자동화** — 한 번 실행으로 전체 리브랜딩
3. **패치 단위 관리** — 각 커스텀을 독립적인 패치로 유지
4. **마이그레이션 노트** — 버전별 breaking changes 기록

## Phase 진행 상태
- [ ] Phase 1: 준비 — 패치 추출, 업스트림 소스 확보
- [ ] Phase 2: 브랜딩 — 자동 리브랜딩 스크립트
- [ ] Phase 3: 인증 시스템 — MOLI_OAUTH 마이그레이션
- [ ] Phase 4: 커스텀 모델 — Solar Pro3 등
- [ ] Phase 5: 프롬프트/i18n
- [ ] Phase 6: SEA 빌드
- [ ] Phase 7: 테스트

## 디렉토리 구조
```
.migration/
├── README.md          # 이 파일
├── patches/           # 카테고리별 diff 패치
├── scripts/           # 자동화 스크립트 (브랜딩 등)
├── notes/             # 버전별 마이그레이션 노트
└── upstream/          # 업스트림 소스 참조
```
