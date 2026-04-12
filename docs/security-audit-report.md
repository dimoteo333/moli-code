# Moli Code 보안 분석 리포트

> 분석일: 2026-04-04
> 분석 범위: 소스코드 전체 + git 이력 (503개 커밋)

---

## 1. [CRITICAL] TLS 인증서 검증 비활성화 (MITM 취약점)

**파일:** `packages/cli/src/services/molimateAuthService.ts:13-14`

```typescript
const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});
```

**문제:** Molimate 인증 서버와 통신 시 TLS 인증서 검증을 완전히 비활성화합니다. 이로 인해 **중간자 공격(MITM)**에 노출되며, 공격자가 인증 서버를 가장하여 사원번호 등 인증 정보를 탈취할 수 있습니다.

- 커밋 `19f1400`에서 추가됨 — Windows 인증서 문제 우회 목적으로 보임
- 이미 `httpsAgent.ts`에 Windows 인증서 스토어 통합 로직이 있으므로, `rejectUnauthorized: false`는 불필요

**해결방안:**
```typescript
// insecureAgent 제거, 대신 Windows 인증서가 이미 주입된 기본 TLS 컨텍스트 사용
// dispatcher: insecureAgent 라인 제거
// 필요 시 NODE_EXTRA_CA_CERTS 환경변수로 사내 CA 인증서 추가
```

---

## 2. [HIGH] API 키가 설정 파일에 평문 저장

**파일들:**
- `packages/cli/src/constants/molimateConfig.ts:16` — `apiKey: string` 필드
- `packages/cli/src/ui/auth/useAuth.ts:555` — settings.json에 평문 저장

```typescript
settings.setValue(persistScope, `env.${m.envKey}`, m.apiKey);
process.env[m.envKey] = m.apiKey;
```

**문제:**
- `molimate.config.json`에 API 키가 평문으로 저장됨
- settings.json (`.moli/` 디렉토리)에도 평문으로 영속화
- `process.env`에 직접 주입되어 자식 프로세스에서도 접근 가능

**해결방안:**
- 시스템 키체인(macOS Keychain, Windows Credential Manager) 활용 — 이미 `packages/core/src/mcp/token-storage/keychain-token-storage.ts`에 구현체가 있음
- 또는 API 키를 암호화하여 저장하고 런타임에 복호화
- `process.env` 주입 후 사용 완료 시 즉시 삭제

---

## 3. [HIGH] 원격 설정 파일 fetch 시 보안 미흡

**파일:** `packages/cli/src/constants/molimateConfig.ts:137`

```typescript
const res = await fetch(remoteUrl, { signal: controller.signal });
```

**문제:**
- 인증서 핀닝(certificate pinning) 없음
- 응답 데이터의 서명(signature) 검증 없음
- `remoteUrl`이 사용자 설정 가능하여 악성 서버로 리다이렉트 가능
- 원격 config에 API 키(`apiKey` 필드)가 포함되어 네트워크 상에서 노출 가능

**해결방안:**
- HTTPS 필수 강제 (URL scheme 검증)
- 응답에 대한 무결성 검증 (HMAC 또는 서명)
- 허용된 도메인 화이트리스트 적용

---

## 4. [MEDIUM] 에러 메시지를 통한 정보 노출

**파일:** `packages/cli/src/utils/httpsAgent.ts:123-135`

```
- For development only (insecure), you can disable certificate verification:
  set NODE_TLS_REJECT_UNAUTHORIZED=0
```

**문제:** TLS 에러 발생 시 `NODE_TLS_REJECT_UNAUTHORIZED=0` 설정을 안내하고 있어, 사용자가 보안을 완전히 비활성화하도록 유도할 수 있음

**해결방안:**
- 프로덕션 빌드에서는 해당 안내 메시지 제거
- `NODE_EXTRA_CA_CERTS` 사용만 권장하도록 변경

---

## 5. [MEDIUM] Employee ID 입력 검증 부족

**파일:** `packages/cli/src/services/molimateAuthService.ts:125-127`

```typescript
export function validateEmployeeId(employeeId: string): boolean {
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(employeeId);
}
```

**문제:** 형식 검증만 있고 **길이 제한**이 없음. 극단적으로 긴 입력이 서버에 전달될 수 있음.

**해결방안:**
```typescript
const MAX_EMPLOYEE_ID_LENGTH = 20;
return employeeId.length > 0 && employeeId.length <= MAX_EMPLOYEE_ID_LENGTH
  && alphanumericRegex.test(employeeId);
```

---

## 6. [MEDIUM] 전역 TLS monkey-patch

**파일:** `packages/cli/src/utils/httpsAgent.ts:53-74`

**문제:** `tls.createSecureContext`를 전역적으로 monkey-patch하여 Windows 인증서를 주입함. 이는 모든 TLS 연결에 영향을 미쳐, Windows 인증서 스토어가 손상된 경우 악성 인증서도 신뢰하게 됨.

**해결방안:**
- 전역 패치 대신 특정 HTTP 클라이언트 인스턴스에만 CA 인증서 적용
- 또는 `NODE_EXTRA_CA_CERTS` 환경변수 활용 권장

---

## 7. [양호] 확인된 보안 양호 항목

| 항목 | 상태 |
|------|------|
| **shinhan.com 등 사내 URL 하드코딩** | 소스코드 및 git 이력 전체에서 미발견 |
| **`.env` 파일 커밋** | `.gitignore`에서 적절히 제외 (line 1-2) |
| **`molimate.config.json` 커밋** | `.gitignore`에서 적절히 제외 (line 93) |
| **GitHub Actions 시크릿** | `secrets.OPENAI_API_KEY` 등으로 적절히 관리 |
| **OAuth 구현** | PKCE 플로우 올바르게 구현 |
| **테스트 데이터** | `'sk-test-key-1'` 등 명확한 플레이스홀더 사용 |
| **git 이력 내 시크릿 유출** | 과거 커밋에서 실제 시크릿 커밋/삭제 이력 없음 |
| **example 파일** | `'sk-your-api-key-here'` 등 플레이스홀더만 포함 |

---

## 우선순위별 조치 요약

| 우선순위 | 이슈 | 파일 | 조치 |
|----------|------|------|------|
| **P0** | `rejectUnauthorized: false` 제거 | `molimateAuthService.ts` | insecureAgent 제거, 기본 TLS 사용 |
| **P1** | API 키 평문 저장 | `useAuth.ts`, `molimateConfig.ts` | 키체인/암호화 저장소 활용 |
| **P1** | 원격 config fetch 보안 | `molimateConfig.ts` | HTTPS 강제 + 무결성 검증 |
| **P2** | 에러 메시지 정보 노출 | `httpsAgent.ts` | `NODE_TLS_REJECT_UNAUTHORIZED=0` 안내 제거 |
| **P2** | Employee ID 길이 제한 | `molimateAuthService.ts` | 최대 길이 검증 추가 |
| **P2** | 전역 TLS monkey-patch | `httpsAgent.ts` | 스코프 제한 또는 환경변수 방식 전환 |
