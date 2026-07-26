# Discord 봇 연동 — 봇 레포용 기능 스펙

이 문서는 별도 저장소로 관리되는 `STUDYHUBBOT`(Discord 봇 프로세스)이 이 웹사이트
레포의 Supabase DB와 어떻게 상호작용해야 하는지 정리한 핸드오프 문서입니다. 봇
레포 작업 시 이 웹사이트 레포를 참고 자료로 열어둔 상태에서 이 문서를 기준으로
구현하면 됩니다.

이 레포(웹사이트) 쪽에는 이미 필요한 DB 함수(RPC)가 전부 구현·검증되어 있습니다.
봇 쪽에서 새로 만들어야 하는 건 **Discord 인터랙션 핸들러(버튼/모달)** 뿐이고,
웹사이트 쪽 DB 스키마 변경은 필요 없습니다.

## 사전 준비 (봇 프로세스 환경변수)

봇은 Supabase에 **service_role** 키로 직접 접속해 아래 RPC들을 호출합니다.

- `SUPABASE_URL` — 이 프로젝트의 `NEXT_PUBLIC_SUPABASE_URL`과 동일한 값
- `SUPABASE_SERVICE_ROLE_KEY` — 이 프로젝트의 `SUPABASE_SERVICE_ROLE_KEY`와 동일한 값
- `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` — 역할 부여/조회용 (기존에 이미 쓰고 있을 것)
- `DISCORD_RATING_ROLE_PREFIX` — 역할 이름 접두사, 기본값 `StudyHub · ` (웹사이트와 반드시 동일해야 역할이 겹치지 않음)
- 웹사이트 URL(딥링크용) — 이 프로젝트의 `NEXT_PUBLIC_SITE_URL`

## 이미 구현되어 있는 것 (참고용, 손댈 필요 없음)

- **Rating 역할 자동 부여**: 웹사이트에서 OAuth로 계정을 연동하면 `lib/discord/rating-role.ts`의
  `syncDiscordRatingRole()`이 즉시 역할을 부여합니다. 그리고 `discord_links`/`profiles`
  테이블이 Supabase Realtime publication에 올라가 있어(`0034_studyhub_bot_interactions.sql`),
  봇이 이미 그 변경을 구독해 자체적으로 역할을 동기화하고 있을 가능성이 높습니다 —
  **아래 ② 계정 등록 패널 구현 전에 봇 레포에 이미 이 로직이 있는지 먼저 확인하세요.**
  있다면 모달 제출 후 역할 부여를 따로 호출할 필요가 없습니다.
- **기존 계정 연동 슬래시 커맨드** (`/연동코드` 등으로 추정): `redeem_discord_link_code`
  RPC를 이미 호출하고 있을 것입니다. 아래 ②는 이 RPC를 호출하는 두 번째 진입점(버튼+모달)을
  추가하는 것뿐입니다.

---

## ① 레이팅 조회 패널

**요구사항**: 관리자가 "레이팅 기록" 채널에 임베드+버튼 패널을 전송해두면, 멤버가
버튼을 누를 때마다 자신의 레이팅/순위를 확인할 수 있다.

**UX 결정 (확정)**: 실제 그래프 이미지 대신, 숫자 요약 임베드 + 웹사이트로 가는
링크 버튼으로 구현한다. (그래프 이미지는 새 렌더링 인프라가 필요해 범위 밖)

### 패널 메시지
관리자 전용 명령(예: `/레이팅패널생성`)으로 채널에 1회성 임베드 + 버튼(`custom_id`
예: `rating_lookup`)을 전송.

### 버튼 클릭 시 (에페메럴 응답)
```
supabase.rpc('get_discord_rating_summary', { p_discord_user_id: interaction.user.id })
```

**응답 (jsonb)**
```jsonc
// 연동 안 된 경우
{ "linked": false }

// 연동된 경우
{
  "linked": true,
  "isBanned": false,
  "nickname": "홍길동",
  "rating": 1730,
  "peakRating": 1780,
  "games": 12,
  "wins": 8,
  "losses": 3,
  "draws": 1,
  "globalRank": 42
}
```

- `linked: false` → 에페메럴로 "먼저 계정을 연동해주세요" + ② 패널 안내(또는 링크)
- `linked: true` → 에페메럴 임베드:
  - 닉네임, 레이팅, 순위(`globalRank`), 전적(`wins`/`losses`/`draws`)
  - 티어 이름/색상: 아래 "레이팅 티어 표" 참고. 정확도가 중요하면 하드코딩 대신
    `app_settings.rating_tiers`(관리자가 커스텀 가능)를 읽어 매칭하는 걸 권장 —
    비어있으면 기본 티어 표를 그대로 쓰면 됨 (웹사이트의 `normalizeRatingTiers()`와
    동일한 검증 로직, `lib/battle/rating.ts` 참고).
  - "자세히 보기" 링크 버튼 → `${SITE_URL}/rating/history`
- `isBanned: true`인 경우 UI에서 굳이 구분 처리하지 않아도 되지만(값 자체가
  이미 정상적으로 채워져 있음), 원한다면 "제재된 계정" 안내를 추가로 붙여도 됨.

이 RPC는 `service_role` 전용입니다 (다른 role로 호출 시 permission denied).

---

## ② 계정 등록 패널

**요구사항**: 관리자가 "계정 등록" 채널에 임베드+버튼 패널을 전송해두면, 멤버가
버튼을 눌러 모달에 연동코드를 입력하는 것만으로 계정을 연동할 수 있다.

**UX 결정 (확정)**: 새 DB/RPC 없이 기존 연동코드 시스템을 버튼+모달로 감싼다.

### 패널 메시지
관리자 전용 명령으로 채널에 1회성 임베드 + 버튼(예: `custom_id: discord_link_start`) 전송.

### 버튼 클릭 시
텍스트 입력 필드 1개짜리 모달(`custom_id: discord_link_modal`)을 오픈.
라벨 예: "연동코드 8자리 (웹사이트 설정 페이지에서 발급)".

사용자는 웹사이트 `/settings`에서 미리 코드를 발급받아 옵니다 (기존 UX, 변경 없음).
코드는 대문자+숫자 8자리, 알파벳은 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
(혼동되는 `I`, `O`, `0`, `1` 제외). 대소문자 구분 없이 입력받아도 됨 — RPC가
내부적으로 `upper(trim())` 처리함.

### 모달 제출 시
```
supabase.rpc('redeem_discord_link_code', {
  p_code: <모달 입력값>,
  p_discord_user_id: interaction.user.id,
  p_discord_username: interaction.user.username, // 또는 tag
})
```

**응답 (jsonb)**
```jsonc
// 성공
{ "ok": true, "userId": "...", "nickname": "홍길동", "rating": 1200 }

// 실패
{ "ok": false, "error": "invalid_code" }
{ "ok": false, "error": "rate_limited", "retryAfter": "2026-07-26T12:34:56Z" }
{ "ok": false, "error": "account_unavailable" }  // 탈퇴/이용정지 계정
{ "ok": false, "error": "link_conflict" }         // 동시성 충돌, 재시도 안내
```

- `ok: true` → 성공 메시지 + (봇에 자체 역할 동기화 로직이 없다면) 반환된 `rating`
  값으로 티어를 계산해 즉시 역할 부여. 이미 realtime으로 동기화되고 있다면 생략.
- `ok: false` → `error` 값별로 안내 메시지 분기:
  - `invalid_code`: "코드가 올바르지 않거나 만료됐습니다 (10분 유효)"
  - `rate_limited`: "잠시 후 다시 시도해주세요" (`retryAfter`까지 남은 시간 표시 가능)
  - `account_unavailable`: "이용 정지된 계정은 연동할 수 없습니다"
  - `link_conflict`: "일시적인 오류입니다. 다시 시도해주세요"
- Discord 계정 하나는 StudyHub 계정 하나에만 연동됩니다. 같은 Discord 계정으로 다시
  연동하면 기존 연동은 자동으로 새 계정으로 교체됩니다 (RPC가 내부에서 처리).

이 RPC도 `service_role` 전용입니다.

---

## 레이팅 티어 표 (기본값, `RATING_TIERS` — `lib/battle/rating.ts`)

| 최소 | 최대 | 이름 | 색상 |
|---|---|---|---|
| 0 | 399 | Iron | `#52525b` |
| 400 | 699 | Bronze | `#92400e` |
| 700 | 899 | Silver | `#64748b` |
| 900 | 1099 | Newbie | `#71717a` |
| 1100 | 1199 | Advanced Newbie | `#4d7c0f` |
| 1200 | 1299 | Pupil | `#16a34a` |
| 1300 | 1399 | Advanced Pupil | `#059669` |
| 1400 | 1499 | Specialist | `#0891b2` |
| 1500 | 1599 | Advanced Specialist | `#0d9488` |
| 1600 | 1749 | Expert | `#2563eb` |
| 1750 | 1899 | Advanced Expert | `#4f46e5` |
| 1900 | 1999 | Candidate Master | `#7c3aed` |
| 2000 | 2099 | Advanced Candidate Master | `#9333ea` |
| 2100 | 2199 | Master | `#d97706` |
| 2200 | 2299 | Advanced Master | `#ca8a04` |
| 2300 | 2399 | International Master | `#ea580c` |
| 2400 | 2599 | Grandmaster | `#ef4444` |
| 2600 | 2799 | International Grandmaster | `#dc2626` |
| 2800 | 2999 | Elite Grandmaster | `#e11d48` |
| 3000 | 3299 | Legendary Grandmaster | `#b91c1c` |
| 3300 | 3599 | Supreme Grandmaster | `#a21caf` |
| 3600 | 3999 | Mythic Grandmaster | `#7e22ce` |
| 4000 | 4499 | Titan | `#0369a1` |
| 4500 | 4799 | Apex | `#be185d` |
| 4800 | 5000 | Ultimate Legend | `#991b1b` |

> 관리자가 `app_settings.rating_tiers`로 이 표를 커스텀할 수 있습니다. 정확히
> 맞추려면 하드코딩 대신 `app_settings` 테이블에서 `rating_tiers` 컬럼을 읽어
> 검증(연속 구간, 0~5000, 색상 hex 형식 등 — `normalizeRatingTiers()` 참고) 후
> 쓰고, 비어있거나 검증 실패 시 위 기본표로 폴백하세요.

## 관련 파일 (이 레포 기준)

- `supabase/migrations/0035_discord_code_linking.sql` — `redeem_discord_link_code`
- `supabase/migrations/0039_discord_bot_rating_lookup.sql` — `get_discord_rating_summary`
- `lib/discord/rating-role.ts` — 역할 생성/부여/회수 로직 (참고용, 봇에서 동일 로직 필요 시 참고)
- `lib/battle/rating.ts` — 티어 계산 로직 원본
