-- =========================================================
-- StudyHub initial schema
-- =========================================================
create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  avatar_url text,
  banner_url text,
  bio text,
  grade_level text,
  target_score text,
  target_study_minutes int default 60,
  exam_date date,
  onboarding_completed boolean not null default false,
  xp int not null default 0,
  coins int not null default 0,
  level int not null default 1,
  streak_days int not null default 0,
  last_study_date date,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- subjects / units ----------
create table public.subjects (
  id text primary key,
  name_ko text not null,
  icon text
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id),
  parent_unit_id uuid references public.units(id),
  name text not null,
  grade_level text,
  order_index int not null default 0
);

-- ---------- questions ----------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id),
  unit_id uuid references public.units(id),
  type text not null default 'multiple_choice',
  difficulty int not null default 2,
  content text not null,
  choices jsonb,
  answer text not null,
  explanation text,
  source text not null default 'seed',
  generated_from_question_id uuid references public.questions(id),
  created_at timestamptz not null default now()
);

-- ---------- diagnostic_results ----------
create table public.diagnostic_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  score numeric,
  predicted_grade text,
  percentile_band text,
  strong_units jsonb default '[]',
  weak_units jsonb default '[]',
  ai_summary text,
  raw_answers jsonb default '[]',
  created_at timestamptz not null default now()
);

-- ---------- user_subject_stats ----------
create table public.user_subject_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null references public.subjects(id),
  current_grade text,
  current_percentile_band text,
  mastery_score numeric default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, subject_id)
);

-- ---------- unit_mastery ----------
create table public.unit_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references public.units(id),
  mastery_score numeric default 0,
  attempt_count int default 0,
  correct_count int default 0,
  last_practiced_at timestamptz,
  unique (user_id, unit_id)
);

-- ---------- homeworks / homework_items ----------
create table public.homeworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text not null default 'pending',
  ai_rationale text,
  generated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.homework_items (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homeworks(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  subject_id text not null references public.subjects(id),
  category text,
  order_index int not null default 0,
  user_answer text,
  is_correct boolean,
  answered_at timestamptz
);

-- ---------- study_plans / study_plan_items ----------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  total_planned_minutes int default 0,
  ai_summary text,
  unique (user_id, date)
);

create table public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  subject_id text references public.subjects(id),
  unit_id uuid references public.units(id),
  title text not null,
  planned_minutes int default 20,
  priority int default 2,
  type text default 'new',
  completed boolean default false,
  order_index int default 0
);

-- ---------- study_sessions ----------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text references public.subjects(id),
  mode text default 'pomodoro',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  focus_minutes int default 0,
  break_minutes int default 0,
  interrupted boolean default false
);

-- ---------- wrong_answers ----------
create table public.wrong_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  subject_id text references public.subjects(id),
  unit_id uuid references public.units(id),
  user_answer text,
  wrong_count int default 1,
  last_wrong_at timestamptz not null default now(),
  mastered boolean default false,
  similar_question_ids jsonb default '[]'
);

-- ---------- daily_feedback ----------
create table public.daily_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  study_minutes int default 0,
  goal_achievement_rate numeric default 0,
  improved_units jsonb default '[]',
  recommended_next text,
  ai_message text,
  unique (user_id, date)
);

-- ---------- badges / user_badges ----------
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  icon text,
  tier text default 'bronze'
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id),
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- ---------- xp_transactions ----------
create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text,
  title text,
  body text,
  read boolean default false,
  created_at timestamptz not null default now()
);

-- ---------- discord_links ----------
create table public.discord_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  discord_user_id text unique,
  discord_username text,
  linked_at timestamptz not null default now(),
  premium_role_granted boolean default false
);

-- ---------- settings ----------
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  homework_time time default '07:00',
  notification_enabled boolean default true,
  theme text default 'system',
  pomodoro_focus_min int default 25,
  pomodoro_break_min int default 5
);

-- =========================================================
-- RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.diagnostic_results enable row level security;
alter table public.user_subject_stats enable row level security;
alter table public.unit_mastery enable row level security;
alter table public.homeworks enable row level security;
alter table public.homework_items enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.study_sessions enable row level security;
alter table public.wrong_answers enable row level security;
alter table public.daily_feedback enable row level security;
alter table public.user_badges enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.discord_links enable row level security;
alter table public.settings enable row level security;
alter table public.subjects enable row level security;
alter table public.units enable row level security;
alter table public.questions enable row level security;
alter table public.badges enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- generic owner-based policies (user_id column)
do $$
declare t text;
begin
  foreach t in array array[
    'diagnostic_results','user_subject_stats','unit_mastery','homeworks',
    'study_plans','study_sessions','wrong_answers','daily_feedback',
    'user_badges','xp_transactions','notifications','discord_links'
  ] loop
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (auth.uid() = user_id);', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (auth.uid() = user_id);', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- settings (pk = user_id)
create policy "settings_select_own" on public.settings for select using (auth.uid() = user_id);
create policy "settings_upsert_own" on public.settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings for update using (auth.uid() = user_id);

-- homework_items / study_plan_items (joined ownership via parent)
alter table public.homework_items enable row level security;
create policy "homework_items_select_own" on public.homework_items for select
  using (exists (select 1 from public.homeworks h where h.id = homework_id and h.user_id = auth.uid()));
create policy "homework_items_update_own" on public.homework_items for update
  using (exists (select 1 from public.homeworks h where h.id = homework_id and h.user_id = auth.uid()));

create policy "study_plan_items_select_own" on public.study_plan_items for select
  using (exists (select 1 from public.study_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "study_plan_items_update_own" on public.study_plan_items for update
  using (exists (select 1 from public.study_plans p where p.id = plan_id and p.user_id = auth.uid()));

-- public read-only reference tables
create policy "subjects_read_all" on public.subjects for select using (true);
create policy "units_read_all" on public.units for select using (true);
create policy "badges_read_all" on public.badges for select using (true);
create policy "questions_read_all" on public.questions for select using (auth.role() = 'authenticated');

-- seed reference data
insert into public.subjects (id, name_ko, icon) values
  ('math','수학','calculator'),
  ('english','영어','languages'),
  ('social','사회','globe'),
  ('science','과학','flask-conical');

insert into public.badges (code, name, description, icon, tier) values
  ('streak_7','7일 연속 학습','7일 연속으로 공부했어요','flame','bronze'),
  ('streak_30','30일 연속 학습','30일 연속으로 공부했어요','flame','gold'),
  ('homework_100','숙제 마스터','숙제 100개 완료','check-circle','silver'),
  ('early_bird','얼리버드','오전 7시 전 학습 5회','sunrise','bronze');

-- trigger: auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email,'@',1)));
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
