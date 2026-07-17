# StudyHub — 기획 및 DB 설계

## 1. 서비스 개요

**컨셉**: AI가 매일 공부를 관리해주는 개인 과외 선생님

**핵심 루프**
```
회원가입 → AI 진단평가 → 예상 등급/취약점 분석
   → 매일: AI 숙제 생성 + AI 학습 플래너 생성
   → 학습(타이머) → 채점 → 오답노트 자동 적재
   → 밤: AI 일일 피드백 생성 → XP/코인/연속학습 갱신
   → 대시보드에서 진행 상황 확인 (반복)
```

## 2. 정보 구조(IA) / 라우트 맵

```
/                          랜딩 페이지
/login, /signup            인증
/onboarding                회원가입 추가정보 (닉네임/학년/목표/시험일)
/onboarding/diagnostic     AI 진단평가 (과목별)
/dashboard                 메인 대시보드
/homework                  오늘의 AI 숙제
/homework/[id]             숙제 풀이 화면
/planner                   AI 학습 플래너 (일간/주간)
/timer                     포모도로 / 집중 타이머
/wrong-notes               오답노트 목록
/wrong-notes/[id]          오답 상세 + 유사문제
/report                    일일/주간 AI 피드백 리포트
/rank                      랭킹 / 배지
/profile                   프로필
/settings                  설정 (Discord 연동 등)
/api/auth/callback         Supabase OAuth 콜백
/api/discord/callback      Discord 연동 콜백
/api/cron/daily-homework   매일 숙제/플래너 생성 크론
/api/cron/daily-feedback   매일 피드백 생성 크론
```

## 3. ERD (요약)

```
users 1─┬─* diagnostic_results ──* subjects
        ├─* user_subject_stats ──* subjects
        ├─* homeworks ──* homework_items ──* questions
        ├─* study_plans ──* study_plan_items
        ├─* study_sessions
        ├─* wrong_answers ──* questions
        ├─* daily_feedback
        ├─* user_badges ──* badges
        ├─* xp_transactions
        ├─* notifications
        ├─* discord_links
        └─* settings (1:1)

subjects 1─* units (단원, self-referencing parent_unit_id)
questions *─1 subjects, *─1 units
```

## 4. 테이블 상세 설계 (Supabase PostgreSQL)

> 모든 PK는 `uuid default gen_random_uuid()`. 모든 테이블 `created_at timestamptz default now()`,
> 수정 가능한 테이블은 `updated_at timestamptz default now()` 포함.
> `user_id`는 전부 `auth.users(id)` 참조.

### 4.1 profiles (auth.users 확장)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK, references auth.users | |
| nickname | text not null | |
| avatar_url | text | |
| banner_url | text | |
| bio | text | |
| grade_level | text | 초4~고3 등 |
| target_score | text | 목표 성적(등급/백분위) |
| target_study_minutes | int | 목표 일일 공부시간(분) |
| exam_date | date | 목표 시험 날짜 |
| onboarding_completed | boolean default false | |
| xp | int default 0 | |
| coins | int default 0 | |
| level | int default 1 | |
| streak_days | int default 0 | |
| last_study_date | date | 연속학습 계산용 |
| role | text default 'user' | user/admin |
| created_at, updated_at | timestamptz | |

### 4.2 subjects
| id | text PK | 'math','english','social','science' |
| name_ko | text | 수학, 영어, 사회, 과학 |
| icon | text | |

### 4.3 units (단원)
| id | uuid PK |
| subject_id | text FK → subjects |
| parent_unit_id | uuid FK → units (nullable, 대단원/소단원) |
| name | text | 예: 분수, 비와 비율, 영어 문법, 식물의 구조 |
| grade_level | text | |
| order_index | int | |

### 4.4 questions (문제 은행 — AI 생성 문제 포함)
| id | uuid PK |
| subject_id | text FK |
| unit_id | uuid FK → units |
| type | text | 'multiple_choice','short_answer','ox' |
| difficulty | int | 1~5 |
| content | text | 문제 본문 |
| choices | jsonb | 객관식 보기 |
| answer | text | 정답 |
| explanation | text | 해설 |
| source | text | 'seed' \| 'ai_generated' |
| generated_from_question_id | uuid FK → questions (nullable) | 유사문제 생성 출처 |
| created_at | timestamptz |

### 4.5 diagnostic_results (진단평가 결과)
| id | uuid PK |
| user_id | uuid FK |
| subject_id | text FK |
| score | numeric | 0~100 |
| predicted_grade | text | 'A+','A','B+',... 또는 백분위 |
| percentile_band | text | '상위 10%' 등 |
| strong_units | jsonb | [{unit_id, name, reason}] |
| weak_units | jsonb | [{unit_id, name, reason, recommendation}] |
| ai_summary | text | AI 총평 |
| raw_answers | jsonb | 문항별 응답 로그 |
| created_at | timestamptz |

### 4.6 user_subject_stats (과목별 현재 실력 스냅샷 — 매 진단/학습마다 갱신)
| id | uuid PK |
| user_id | uuid FK |
| subject_id | text FK |
| current_grade | text | |
| current_percentile_band | text | |
| mastery_score | numeric | 0~100, 단원별 숙련도 종합 |
| updated_at | timestamptz |
unique(user_id, subject_id)

### 4.7 unit_mastery (단원별 숙련도 — 취약점 분석 기반 데이터)
| id | uuid PK |
| user_id | uuid FK |
| unit_id | uuid FK |
| mastery_score | numeric | 0~100 |
| attempt_count | int |
| correct_count | int |
| last_practiced_at | timestamptz |
unique(user_id, unit_id)

### 4.8 homeworks (일일 숙제 헤더)
| id | uuid PK |
| user_id | uuid FK |
| date | date | |
| status | text | 'pending','in_progress','completed' |
| ai_rationale | text | 이 숙제를 낸 이유(취약단원 근거) |
| generated_at | timestamptz |
unique(user_id, date)

### 4.9 homework_items (숙제 세부 문항)
| id | uuid PK |
| homework_id | uuid FK |
| question_id | uuid FK → questions |
| subject_id | text FK |
| category | text | '신규','오답복습','단어' 등 |
| order_index | int |
| user_answer | text |
| is_correct | boolean |
| answered_at | timestamptz |

### 4.10 study_plans (일일/주간 학습 플래너 헤더)
| id | uuid PK |
| user_id | uuid FK |
| date | date |
| total_planned_minutes | int |
| ai_summary | text |
unique(user_id, date)

### 4.11 study_plan_items (플래너 세부 항목)
| id | uuid PK |
| plan_id | uuid FK |
| subject_id | text FK |
| unit_id | uuid FK (nullable) |
| title | text | '분수 개념 복습' 등 |
| planned_minutes | int |
| priority | int | 1(높음)~3(낮음) |
| type | text | 'new','review' |
| completed | boolean default false |
| order_index | int |

### 4.12 study_sessions (타이머 기록)
| id | uuid PK |
| user_id | uuid FK |
| subject_id | text FK (nullable) |
| mode | text | 'pomodoro','free' |
| started_at | timestamptz |
| ended_at | timestamptz |
| focus_minutes | int |
| break_minutes | int |
| interrupted | boolean |

### 4.13 wrong_answers (오답노트)
| id | uuid PK |
| user_id | uuid FK |
| question_id | uuid FK |
| subject_id | text FK |
| unit_id | uuid FK |
| user_answer | text |
| wrong_count | int default 1 |
| last_wrong_at | timestamptz |
| mastered | boolean default false | 재도전 성공 시 true |
| similar_question_ids | jsonb | AI로 재생성한 유사문제 ids |

### 4.14 daily_feedback (AI 일일 피드백)
| id | uuid PK |
| user_id | uuid FK |
| date | date |
| study_minutes | int |
| goal_achievement_rate | numeric | % |
| improved_units | jsonb |
| recommended_next | text |
| ai_message | text | 사람이 읽는 총평 문단 |
unique(user_id, date)

### 4.15 badges / user_badges (게임화)
badges: id uuid PK, code text unique, name text, description text, icon text, tier text
user_badges: id uuid PK, user_id FK, badge_id FK, earned_at timestamptz — unique(user_id, badge_id)

### 4.16 xp_transactions
| id | uuid PK | user_id FK | amount int | reason text | created_at |

### 4.17 notifications
| id | uuid PK | user_id FK | type text | title text | body text | read boolean default false | created_at |

### 4.18 discord_links
| id | uuid PK | user_id FK unique | discord_user_id text unique | discord_username text | linked_at timestamptz | premium_role_granted boolean |

### 4.19 settings (1:1 with profiles)
| user_id | uuid PK FK |
| homework_time | time | 매일 숙제 생성 시각 |
| notification_enabled | boolean |
| theme | text | 'light','dark','system' |
| pomodoro_focus_min | int default 25 |
| pomodoro_break_min | int default 5 |

## 5. RLS 정책 원칙

- 모든 사용자 소유 테이블: `auth.uid() = user_id` 로 select/insert/update/delete 제한
- `subjects`, `units`, `badges`: 공개 read-only (모든 인증 사용자 select 허용, write는 service_role만)
- `questions`: 인증 사용자 select 허용 (자기 숙제/오답에 연결된 문제 조회), insert는 service_role(AI 생성 서버 액션)만
- 크론/AI 서버 액션은 `service_role` 키를 서버 전용 환경(Server Action, Route Handler)에서만 사용 — 절대 클라이언트 노출 금지
- **`profiles`는 본인 행만 select 가능(`profiles_select_own`)** — 랭킹처럼 다른 유저의 데이터를 봐야 하는
  기능은 테이블을 직접 select하지 않고, 노출할 컬럼을 제한한 `security definer` 함수(`get_leaderboard()`)를
  통해서만 조회한다. RLS를 우회하는 대신 함수 자체가 반환 컬럼을 `id/nickname/avatar_url/xp/level/streak_days`로
  제한하므로 `exam_date`, `target_score` 같은 민감할 수 있는 필드는 노출되지 않는다.
  ⚠️ 초기 스캐폴드(0001)에서는 `/rank` 페이지가 `profiles`를 직접 select하도록 되어 있었는데, 위 RLS
  정책 때문에 실제로는 항상 빈 배열이 반환되는 버그가 있었다. 0002 마이그레이션에서 수정됨.

## 5-1. XP / 레벨 시스템 (0002에서 추가)

기존 스캐폴드는 `profiles.level` 컬럼만 존재하고 실제로 계산/저장하는 코드가 없었고, XP 지급도
"클라이언트에서 읽고 → 더하고 → 쓰는" 방식이라 동시 요청 시 XP가 유실될 수 있는 레이스 컨디션이 있었다.
`0002_leaderboard_and_xp_fix.sql`에서 아래 3개의 DB 함수로 이 문제를 해결한다.

| 함수 | 역할 |
|---|---|
| `calculate_level(p_xp int)` | XP → 레벨 변환 공식(순수 함수). Lv1:0xp, Lv2:100xp, Lv3:250xp, Lv4:450xp, Lv5:700xp… (레벨마다 필요 XP가 50씩 증가) |
| `award_xp(p_amount int, p_reason text)` | `auth.uid()` 기준으로 `profiles.xp`를 원자적으로 갱신하고, `calculate_level()`로 레벨을 재계산해 `profiles.level`에 반영, `xp_transactions`에 기록까지 한 트랜잭션으로 처리. **모든 XP 지급은 반드시 이 함수를 통해서만 한다** (`lib/gamification/xp.ts`의 `awardXP()` 래퍼 사용) |
| `bump_streak()` | 연속학습일(streak_days)/최종학습일(last_study_date)을 원자적으로 갱신. 같은 날 재호출은 무시 |

`lib/gamification/level.ts`는 UI에서 "다음 레벨까지 남은 XP" 진행률을 보여주기 위한 `calculate_level()`의
TypeScript 미러(`getLevelProgress()`)를 제공한다. **DB 함수와 반드시 동일한 공식을 유지해야 한다** — 공식을
바꾸려면 두 파일을 함께 수정할 것.

레벨은 현재 `TopBar`(전역 헤더)와 `/rank` 리더보드에 노출된다.

## 6. AI 파이프라인 설계

| 기능 | 트리거 | 입력 | 출력 |
|---|---|---|---|
| 진단평가 생성 | 온보딩 직후 | grade_level, subject | 문항 세트(json) |
| 예상 등급 계산 | 진단평가 채점 직후 | score, grade_level, subject | grade, percentile_band |
| 취약점 분석 | 진단평가 채점 직후 | 문항별 정오답+단원 | weak_units[], strong_units[], summary |
| 숙제 생성 | 매일 설정 시각(cron) | weak_units, 오답노트, 목표시간 | homework_items[] |
| 학습 계획 생성 | 매일 설정 시각(cron) | weak_units, 시험일, 목표시간 | study_plan_items[] |
| 일일 피드백 생성 | 매일 자정 근처(cron) | 당일 세션/숙제 기록 | ai_message, 추천 |
| 유사 문제 생성 | 오답노트에서 '유사문제' 클릭 | 원본 문제 | 새 question row |

모든 AI 호출은 Anthropic Messages API(`claude-sonnet-4-6`)를 사용하고, **structured output은 JSON-only 응답**으로 강제 후 서버에서 파싱합니다(위 anthropic_api_in_artifacts 패턴과 동일하게 `lib/ai/client.ts`에서 공통 래핑).
