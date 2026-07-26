# Git 충돌 해결 및 마이그레이션 정합성 점검 보고서

- **작성일**: 2026-07-25
- **저장소**: `OrbitDev-ux/STUDYHUB-us` (origin), 브랜치 `main`
- **작업자**: Claude (요청자: yoibuymac@proton.me)
- **작업 범위**: `git stash pop` 충돌로 마커가 남아있던 7개 파일 해결, 그 과정에서 발견된 Supabase 마이그레이션 번호 충돌 정리, 최종 빌드 검증

---

## 1. 배경

세션 시작 시 프로젝트 문서(`CLAUDE.md`, `docs/`) 확인을 요청받아 분석하던 중, `git status`에서 다음 7개 파일이 `UU`(unmerged) 상태로 남아있는 것을 발견했습니다.

```
UU README.md
UU app/(auth)/signup/page.tsx
UU components/shared/nav-items.ts
UU messages/en.json
UU messages/ja.json
UU messages/ko.json
UU messages/zh.json
```

파일 내부에 `<<<<<<< Updated upstream` / `=======` / `>>>>>>> Stashed changes` 마커가 그대로 남아있어 **`git stash pop` 도중 충돌이 발생했고 해결되지 않은 채로 방치된 상태**였습니다(마커 표기가 "Updated upstream"/"Stashed changes"이므로 브랜치 병합이 아닌 stash pop 충돌). 이 상태에서는 `.ts`/`.tsx`/`.json` 파일 파싱 자체가 실패해 빌드가 불가능했습니다.

## 2. 저장소 사전 확인

| 항목 | 값 |
|---|---|
| 작업 경로 | `/Users/ys.kim/STUDYHUB-US` |
| remote | `https://github.com/OrbitDev-ux/STUDYHUB-us.git` |
| 로컬 브랜치 | `main` |
| 원격 브랜치 | `origin/main`, `origin/claude/analysis-and-work-8fa3gy` |

`docs/PRODUCT.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `SECURITY.md`, `BRAND.md`, `TEAM.md`는 로컬·원격 모든 ref의 히스토리를 통틀어 한 번도 생성된 적이 없음을 확인했습니다(별도 이슈로, 이번 작업 범위에는 포함하지 않음).

## 3. 파일별 충돌 해결 내역

### 3.1 README.md (3개 블록)

| 블록 | Upstream | Stashed | 처리 |
|---|---|---|---|
| 마이그레이션 실행 안내 | `0001~0035` 순서 설명 | `0001~0011_polar_billing.sql` 순서 설명 | 실제 상태(0001~0037) 반영하도록 재작성 |
| Discord 역할 동기화 / Polar 결제 안내 | 항목 7(Discord Rating 역할) 마무리 문단 | 신규 항목 8(Polar 결제 연동) | 둘 다 유지, 순서대로 이어붙임 |
| 환경 변수 목록 | `DEVELOPER_ACCESS_CODE`, `DEVELOPER_SESSION_SECRET` | `POLAR_ACCESS_TOKEN` 등 4개 | 서로 무관한 항목이라 모두 유지 |

병합 후 마이그레이션 파일명 변경(§4)에 맞춰 `0011_polar_billing.sql` → `0036_polar_billing.sql` 참조도 갱신.

### 3.2 app/(auth)/signup/page.tsx

두 버전이 **같은 화면(회원가입 폼)의 신/구 구현**이라 애디티브 병합이 불가능했습니다.

- `Updated upstream`: `SignupForm` 컴포넌트(`components/auth/signup-form.tsx`) 사용. 해당 컴포넌트는 OAuth 버튼 + 닉네임/이메일/비밀번호/비밀번호 확인 + 약관 동의 체크박스 + 세분화된 에러 메시지(rate_limited, terms_required, password_mismatch, email_taken)를 포함하는 완성형.
- `Stashed changes`: 리팩터링 이전 구버전 인라인 폼. `OAuthButtons`/`Label`/`Input`/`SubmitButton`/`signUpWithEmail` 임포트 누락으로 그대로 두면 컴파일 에러 발생.

**처리**: upstream(`SignupForm` 컴포넌트) 채택, stashed 인라인 코드는 제거. 기능 손실 없음(상위 호환).

### 3.3 components/shared/nav-items.ts

애디티브 충돌로 판단해 양쪽 모두 유지.

- 임포트: upstream의 아이콘 목록에 stashed에만 있던 `CreditCard` 추가.
- 네비게이션 배열: upstream의 `/settings` 항목과 stashed의 `/plan` 항목을 모두 유지.
- `MOBILE_NAV_ITEMS`는 인덱스 `0,3,4,12,13,14`만 참조하므로 영향 없음(검증 완료).

### 3.4 messages/en.json, ja.json, ko.json, zh.json

4개 파일 모두 동일 구조(`nav` 키, 42~50번째 줄)로 충돌. `nav-items.ts`와 대응되는 내용이라 동일한 원칙으로 병합: `forum`, `messages`, `profile`, `settings`(upstream) + `plan`(stashed)을 모두 유지, `profile` 중복만 제거.

병합 후 4개 파일 모두 `node -e "JSON.parse(...)"`로 유효성 검증 완료.

## 4. Supabase 마이그레이션 번호 충돌 (README 병합 중 발견)

`0011_polar_billing.sql` 병합 문구를 정리하던 중, 실제 `supabase/migrations/` 디렉터리에서 번호 중복을 발견했습니다.

| 번호 | 이미 커밋된 파일 | 새로 추가된(untracked) 파일 |
|---|---|---|
| 0011 | `0011_auth_rate_limiting.sql` | `0011_polar_billing.sql` |
| 0012 | `0012_profile_media.sql` | `0012_grant_authenticated_table_access.sql` |

Polar 결제 기능이 stash되어 있는 동안 `main` 쪽에서 0011/0012 번호를 이미 다른 기능(로그인 rate limiting, 프로필 이미지 Storage)에 사용한 것이 원인으로 추정됩니다.

**조치**:
1. 두 파일의 내용을 확인해 서로 의존관계가 없고, 참조하는 테이블(`profiles`, `discord_links` 등)이 모두 `0001_init.sql`에서 이미 생성되어 있어 뒤로 미뤄도 안전함을 확인.
2. 기존 상대 순서(Polar 먼저, GRANT 나중)를 유지한 채 번호만 재부여:
   - `0011_polar_billing.sql` → `0036_polar_billing.sql`
   - `0012_grant_authenticated_table_access.sql` → `0037_grant_authenticated_table_access.sql`
3. 리포지토리 전체(`.md/.ts/.tsx/.sql/.json`)에서 구 파일명 참조를 검색 — README.md 외 참조처 없음을 확인 후 README 문구도 갱신.
4. 재번호 후 `0001~0037`이 공백·중복 없이 완전히 연속임을 스크립트로 검증.

### 4.1 빈 마이그레이션 파일 삭제

점검 과정에서 `20260724144517_remove_old_award_xp.sql`(0바이트, untracked)을 추가로 발견했습니다.

- `award_xp()` 함수의 변경 이력(`0002` → `0004` → `0010`, 매번 `drop function if exists` 후 재생성)을 추적한 결과, 현재 코드베이스에 정리가 필요한 구버전/중복 오버로드가 없음을 확인.
- 리포지토리 전체에서 파일명 참조 검색 결과 0건.
- 사용자 확인 후 **삭제**. 삭제 후 마이그레이션 번호 연속성 재검증 완료(`0001~0037`, 총 37개, 공백·중복 없음).

## 5. 최종 검증

| 검증 항목 | 방법 | 결과 |
|---|---|---|
| 충돌 마커 잔존 | 리포지토리 전체 `grep -rl` (`<<<<<<<`/`=======`/`>>>>>>>`) | 0건 |
| JSON 유효성 | `node -e "JSON.parse(...)"` (4개 언어 파일) | 통과 |
| `$$...$$` 함수 블록 짝 | 마이그레이션 38개 파일 스캔 | 전부 정상 |
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | 에러 없음 |
| 프로덕션 빌드 | `npm run build` | 성공, 62개 라우트 정상 생성 (`/plan`, `/settings` 등 포함) |

## 6. 남은 작업 / 후속 권고

- **git 인덱스 상태**: 7개 파일은 내용상 충돌이 모두 해결됐지만, `git add`를 하지 않아 `git status`에는 여전히 `UU`로 표시됩니다. 스테이징/커밋 여부는 별도 확인 후 진행 필요.
- **누락 문서**: `docs/PRODUCT.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `SECURITY.md`, `BRAND.md`, `TEAM.md` 6종이 히스토리상 한 번도 작성된 적 없음 — 이번 작업 범위 밖이라 별도 처리 필요.
- **기획 문서(`docs/01_PLANNING_AND_DB.md`) 최신화**: 실제 구현 범위(온라인 저지/배틀/대회/포럼/메시지/개발자 콘솔/결제 등)가 기획 문서 스코프보다 훨씬 넓어진 상태 — 문서 갱신 필요.
- 아직 커밋되지 않은 `?? ` 상태 파일들(`app/(main)/plan/`, `app/api/polar/`, `app/api/webhooks/`, `lib/polar/`, `supabase/config.toml`, `supabase/migrations/0036_*`, `0037_*` 등)은 이번 병합으로 정상 빌드에 포함되어 있으나, 여전히 git에는 추가되지 않은 상태입니다.
