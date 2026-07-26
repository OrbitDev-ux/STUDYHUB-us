# StudyHub — AI가 매일 공부를 관리해주는 개인 과외 선생님

AI가 실력을 진단하고, 예상 등급을 계산하고, 취약점을 분석하고, 매일 숙제와 학습 계획을 자동으로 만들어주는 개인 학습 코치 플랫폼입니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui 스타일 컴포넌트, Framer Motion |
| Backend | Next.js Server Actions, Route Handlers |
| Database | Supabase PostgreSQL (Row Level Security) |
| Auth | Supabase Auth (Email/Password, Google OAuth, Discord OAuth) |
| AI | Google Gemini API (`gemini-2.5-flash`, 기본값) — Anthropic API(`claude-sonnet-4-6`), GLM API(`glm-5.2-lite`, Z.ai)로도 전환 가능 — `AI_PROVIDER` 환경변수로 전환 |
| 배포 | Vercel, Docker |

## 폴더 구조

```
studyhub/
├── app/
│   ├── (auth)/                # 로그인/회원가입
│   ├── onboarding/             # 회원가입 후 정보수집 + AI 진단평가
│   ├── (main)/                 # 로그인 후 메인 앱 (대시보드, 숙제, 플래너, 타이머, 오답노트, 리포트, 랭킹, 프로필, 설정)
│   ├── api/
│   │   ├── auth/callback/      # Supabase OAuth/이메일 인증 콜백
│   │   ├── discord/callback/   # Discord 계정 연동 콜백
│   │   └── cron/                # 매일 숙제/플래너/피드백 자동 생성 크론
│   └── layout.tsx, globals.css
├── components/
│   ├── ui/                     # shadcn 스타일 기본 컴포넌트
│   ├── shared/                 # 네비게이션, 테마, OAuth 버튼
│   ├── homework/ planner/ timer/
├── lib/
│   ├── ai/                     # Gemini/Anthropic/GLM 공용 래퍼 + 기능별 프롬프트(진단/숙제/플래너/피드백)
│   └── supabase/               # 브라우저/서버/미들웨어 클라이언트
├── supabase/migrations/0001_init.sql   # 전체 DB 스키마 + RLS 정책 + 시드 데이터
├── docs/01_PLANNING_AND_DB.md          # 기획 및 ERD 문서
├── types/index.ts
├── Dockerfile, docker-compose.yml, vercel.json
└── .env.example
```

## 로컬 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. Supabase 프로젝트 생성
1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/0001_init.sql`부터 `0037_grant_authenticated_table_access.sql`까지 번호 순서대로 실행
   (기본 스키마/RLS → 레벨·XP·배지·코인 → 점검 모드 → 숙제/플랜 → Discord → 스키마 복구 → 로그인/가입 rate limiting → 프로필 이미지 Storage → 플래너 보상 및 세션 판정 강화 → ... → 온라인 저지/배틀/대회/포럼/개발자 콘솔 → Discord 코드 연동 → authenticated/anon 테이블 GRANT 복구)
   `0010`은 일부 운영 DB에서 중간 마이그레이션이 누락된 경우를 복구하는 멱등
   마이그레이션이므로, 이미 최신 상태인 DB에서도 안전하게 실행할 수 있습니다. `0014`는
   초1~고3 학년별 문제은행 풀이 기록과 최초 정답 XP 지급 함수를 추가합니다.
   `0015`는 1:1 문제풀이 매칭, 서버 채점, 배틀 기록과 ELO 레이팅을 추가합니다.
   `0016`은 레이팅 이력, 대회 순위표, 포럼, 댓글, 좋아요, 사용자 차단과 1:1 메시지를 추가합니다.
   `0017`은 모든 계정에 가입 즉시 1200 ELO를 만들고 가입일을 그래프 시작점으로 기록하며, 대회·사용자 검색에 레이팅을 연결합니다.
   `0018`은 배틀·대회·메시지·레이팅 테이블을 Supabase Realtime publication에 연결합니다.
   `0019`는 Codeforces 방식의 배틀·대회 Rating 정산과 신규 사용자 보정을 추가합니다.
   `0020`은 전체 Rating 순위와 개인정보를 제한한 공개 프로필 조회 함수를 추가합니다.
   `0021`은 개발자 콘솔용 문제 상태, 대회 공개 상태, 감사 로그와 출제 문제 보호 정책을 추가합니다.
   `0022`는 배틀·대회·운영자 조정 등 모든 Rating 변경에 사유가 포함된 실시간 알림을 추가합니다.
   `0023`은 Rating 이벤트명·배틀 상대를 영구 보존하고 관리자 감사 로그 검색 인덱스를 추가합니다.
   `0024`는 1:1 메시지 신고, 관리자 처리 상태, 채팅 제한과 도배 방지를 추가합니다.
   `0025`는 개발자용 전체 Rating 이벤트 조회와 안전한 삭제·후속 History 재계산,
   사용자 알림 및 실시간 그래프 동기화를 추가합니다.
   `0026`은 지정 사용자 배틀 요청·수락·거절 알림과 관리자 포럼 중요 공지
   자동 고정·전체 알림을 추가합니다.
   `0027`은 Super Admin 역할, 안전한 운영자 승격·강등, 감사 로그 수정·보관·복원과
   변경 전후 원본을 보존하는 append-only 개정 이력을 추가합니다. 기존 Super Admin이
   없다면 가장 먼저 생성된 Admin 한 명을 최초 Super Admin으로 자동 승격합니다.
   `0028`은 Super Admin 사용자 밴·해제·영구 삭제, 밴 계정의 서비스 접근 및 전체
   리더보드 제외, 공개 프로필 비활성 표시와 원본 증적을 보존하는 감사 로그 삭제를 추가합니다.
   `0029`는 온라인 저지 문제·테스트케이스·사용자 제출·판정 이력과 RLS 기반을 추가합니다.
   `0030`은 온라인 저지를 고정 Input 기반 Output Answer 방식으로 전환합니다.
   `0031`은 고정 Input 문제를 사용하는 실시간 1:1 코딩 배틀과 Codeforces식 Rating 정산을 추가합니다.
   `0032`는 대회 시작 전 Register와 참가자별 Rated/Unrated 선택·정산을 추가합니다.
   `0033`은 관리자 편집형 0~5000 Rating 계급·색상, 예정 대회 수정, 고정 Input Output Judge
   대회, 서버 시각 기반 시작 전 카운트다운과 Super Admin 감사 로그 선택 일괄 작업을 추가합니다.
   `0034`는 STUDYHUBBOT 온라인 상태, Rating 역할 즉시 동기화와 중요 알림 DM을 위한
   Supabase Realtime 웹↔봇 브리지를 추가합니다.
   `0035`는 웹에서 생성하고 Discord `/연동코드` 명령으로 사용하는 해시 기반 10분
   일회용 계정 연결 코드와 입력 시도 제한을 추가합니다.
   별도의 코드 작성칸 없이 서버에는 사용자의 최종 출력 답안만 저장됩니다.
3. Authentication > Providers에서 Google, Discord OAuth 활성화 (선택)
4. Project Settings > API에서 URL / anon key / service_role key 확인
5. (선택) 관리자 계정 지정: 첫 관리자를 만드는 UI는 없습니다. 가입 후 SQL Editor에서 직접
   `update public.profiles set role = 'admin' where id = '<user-uuid>';` 를 실행하세요.
   관리자는 설정 페이지에서 서버 점검 모드를 켜고 끌 수 있고, 이메일로 사용자를 찾아
   유료 플랜(Free/Basic/Pro)을 수동으로 변경할 수 있습니다. 아직 실제 결제(PG) 연동은
   없어서, 결제 확인 후 관리자가 직접 반영하는 방식입니다. 플랜별 차이는
   `lib/plan.ts`의 `PLAN_LIMITS`에서 관리합니다 (현재는 숙제 문제 수 상한, AI 리포트
   기록 보관 기간).
6. (선택) 점검 모드 Discord 알림: `.env.local`에 `DISCORD_MAINTENANCE_WEBHOOK_URL`을
   설정하면 점검 모드를 켜고 끌 때마다 해당 Discord 채널로 알림이 전송됩니다.
   (Discord 채널 설정 > 연동 > 웹훅에서 발급. 미설정 시 알림만 안 갈 뿐 점검 모드
   자체는 정상 동작합니다.)
7. (선택) 매일 알림 Discord DM: `DISCORD_BOT_TOKEN`을 설정하면(기존 Discord 계정
   연동용 봇과 동일한 토큰) 설정 페이지에서 "알림 받기"를 켠 사용자에게 매일
   숙제·플래너·피드백이 생성될 때마다 DM으로 알려줍니다. Discord 계정이 연동돼
   있어야 하고, 봇이 해당 유저와 공통 서버에 있어야 DM 전송이 가능합니다
   (Discord API 제약). 플랜이 Basic/Pro로 바뀌면 이미 연동된 계정의
   `discord_links.premium_role_granted`도 자동으로 갱신됩니다. 나란히 있는
   `STUDYHUBBOT`을 실행하면 Rating 역할·중요 알림·웹 명령 상호작용도 활성화됩니다.
   웹과 봇에 동일한 `DISCORD_GUILD_ID`/`GUILD_ID`, 봇 토큰과
   `DISCORD_RATING_ROLE_PREFIX`를 설정하면 OAuth 연동 즉시 웹 Rating 티어
   역할이 지급되며 연동 해제 시 바로 회수됩니다.

### 3. 환경 변수 설정
```bash
cp .env.example .env.local
```
`.env.local`을 채워주세요:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_EMAIL_CONFIRMATION_DISABLED=true` — 임시로 인증 메일 없이 가입 즉시 자동 확인/로그인. 이메일 인증을 다시 켤 때는 `false`로 변경
- `GEMINI_API_KEY` — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 발급 (기본 AI 제공자)
- `AI_PROVIDER` — `gemini`(기본) / `anthropic` / `glm` 중 선택. `anthropic`이면 `ANTHROPIC_API_KEY`, `glm`이면 `GLM_API_KEY`가 필요
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — Discord 연동 기능을 쓸 경우
- `DISCORD_REDIRECT_URI` — Discord Developer Portal의 OAuth2 > Redirects에 등록한
  Callback URL과 완전히 동일한 값. 로컬 기본값은
  `http://localhost:3000/api/discord/callback`, 배포 환경은
  `https://<서비스 도메인>/api/discord/callback`
- `DISCORD_BOT_TOKEN` / `DISCORD_GUILD_ID` — 연동 직후 Rating 역할을 즉시 지급할 경우
- `DISCORD_RATING_ROLE_PREFIX` — 봇과 웹이 공유하는 Rating 역할 접두사(기본 `StudyHub · `)
- `CRON_SECRET` — 임의의 랜덤 문자열 (크론 라우트 인증용)
- `DEVELOPER_ACCESS_CODE` — 선택 사항. 설정하면 `/developer/login`에서 관리자 계정 외에 추가 접근 코드를 요구
- `DEVELOPER_SESSION_SECRET` — 개발자 전용 8시간 세션 서명값. 미설정 시 `SUPABASE_SERVICE_ROLE_KEY`로 안전하게 대체

### 4. 개발 서버 실행
```bash
npm run dev
```
http://localhost:3000 접속

### 5. 타입 체크 / 빌드
```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Docker로 실행

```bash
cp .env.example .env.local   # 값 채우기
docker compose up --build
```

## 배포 (Vercel)

1. GitHub에 푸시 후 Vercel에서 Import
2. Environment Variables에 `.env.example`의 모든 키 등록
3. `vercel.json`에 정의된 Cron이 자동으로 매시간 `/api/cron/daily-homework`, 매일 `/api/cron/daily-feedback`을 호출합니다
   - Vercel Cron은 요청 헤더에 자동으로 인증을 붙이지 않으므로, `CRON_SECRET`을 Vercel의 Cron 설정 또는 미들웨어에서 함께 검증하도록 구성되어 있습니다.

## 핵심 사용자 플로우

1. **회원가입** → 닉네임/학년/목표 공부시간/목표 성적/시험 날짜 입력 (`/onboarding`)
2. **AI 진단평가** → 수학/영어/사회/과학 4과목 순차 진단, 과목별 예상 등급·백분위·취약 단원 계산 (`/onboarding/diagnostic`)
3. **대시보드** → 오늘 공부시간, 연속학습, 숙제 완료율, 예상 등급, 취약 단원, 목표 달성률 한눈에 확인 (`/dashboard`)
4. **AI 숙제** → 취약 단원 + 오답 복습 위주로 매일 자동 생성 (`/homework`)
5. **AI 학습 플래너** → 시험일까지 남은 기간을 고려한 우선순위별 오늘 할 일 (`/planner`)
6. **포모도로 타이머** → 25분 집중 + 5분 휴식, 세션 자동 기록 및 XP/연속학습 갱신 (`/timer`)
7. **오답노트** → 틀린 문제 자동 적재, AI가 유사 문제를 재생성해 재도전 (`/wrong-notes`)
8. **AI 일일 피드백** → 하루 학습을 요약하고 내일 우선순위를 제안 (`/report`)
9. **랭킹/배지** → XP 기반 랭킹, 배지 컬렉션 (`/rank`)
10. **Discord 연동** → 계정 연동 및 XP/배지 동기화 기반 마련 (`/settings`)
11. **학년별 문제은행** → 초1~고3, 수학/영어/사회/과학 768문항 즉시 연습 및 풀이 기록 (`/practice`)
12. **계정 및 보안** → 비밀번호 변경, 다른 기기 로그아웃, 전체 학습 데이터 내보내기 (`/settings`)
13. **학습 스트릭** → 타이머·문제·숙제·플래너 활동을 최근 1년 GitHub형 잔디로 시각화 (`/streak`)
14. **문제풀이 배틀** → 가입 즉시 1200점, Codeforces식 영문 등급·색상·가입일부터의 그래프, 예상 순위·퍼포먼스 기반 Rating 정산 (`/battle`)
15. **학습 대회** → 관리자 대회 개설, 서버 채점, 점수·페널티 기반 실시간 순위표 (`/contests`)
16. **커뮤니티 포럼** → 카테고리별 게시글, 댓글, 좋아요와 공지 (`/forum`)
17. **1:1 메시지** → Supabase Realtime 메시지, 온라인 상태, 읽음·미확인 표시, 사용자 차단을 지원하는 내부 대화 (`/messages`)
18. **개발자 콘솔** → 전용 서명 세션 로그인, 문제 출제, 대회 개최, 사용자·Rating·점검 모드 관리, Super Admin 권한 계층과 변경 이력이 보존되는 감사 로그 편집 (`/developer/login`)

## 데이터베이스 설계

전체 ERD와 테이블 스펙은 [`docs/01_PLANNING_AND_DB.md`](./docs/01_PLANNING_AND_DB.md)를 참고하세요. 모든 사용자 소유 테이블에는 `auth.uid() = user_id` 기반 RLS가 적용되어 있으며, `subjects`/`units`/`questions`/`badges`는 인증된 사용자에게 읽기 전용으로 공개됩니다. AI가 생성하는 문제/숙제/플래너는 `service_role` 키를 사용하는 서버 전용 클라이언트(`createAdminClient`)로 RLS를 우회해 삽입됩니다.

## 알려진 제약 / 다음 단계

이 저장소는 실제 서비스로 배포 가능한 수준의 **동작하는 스캐폴드**입니다. 알림 센터, 배지 자동 지급, AI 재시도/타임아웃, 프로필 이미지 업로드는 구현되어 있습니다. 다음 항목은 외부 서비스 계약이나 운영 인프라가 필요한 범위입니다:

- Discord 봇 프로세스의 상시 운영, 재시작 정책과 로그/가용성 모니터링
- 브라우저 기반 E2E 테스트와 배포 후 합성 모니터링
- AI 호출 비용·품질 모니터링과 운영 대시보드

### ✅ 0002 마이그레이션에서 수정된 버그
- `/rank` 랭킹이 `profiles` 테이블을 직접 select했는데 RLS가 본인 행만 허용해 항상 빈 배열이 반환되던 버그
  → `get_leaderboard()` security definer 함수로 교체
- `profiles.level` 컬럼이 계산/갱신되는 코드가 전혀 없던 버그 → `calculate_level()` + `award_xp()`로 해결, TopBar/랭킹에 노출
- XP를 "읽고-더하고-쓰는" 방식으로 갱신해 동시 요청 시 유실될 수 있던 레이스 컨디션 → `award_xp()` RPC로 원자화
- 타이머 학습 완료 시 XP가 `xp_transactions`에 기록되지 않던 불일치 → 모든 XP 지급 경로를 `award_xp()`로 통일
