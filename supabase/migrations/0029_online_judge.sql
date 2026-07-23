-- Sandboxed online judge problems, hidden test cases, submissions, and results.
-- User code is never executed inside Postgres or the StudyHub web process.

create table if not exists public.oj_problems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 120),
  statement text not null check (char_length(statement) between 10 and 20000),
  input_description text not null default '',
  output_description text not null default '',
  constraints_text text not null default '',
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  grade_level text check (
    grade_level is null or grade_level in (
      '초1','초2','초3','초4','초5','초6',
      '중1','중2','중3','고1','고2','고3'
    )
  ),
  time_limit_ms integer not null default 2000 check (time_limit_ms between 100 and 10000),
  memory_limit_kb integer not null default 128000 check (memory_limit_kb between 16000 and 512000),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  submission_count integer not null default 0 check (submission_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oj_test_cases (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.oj_problems(id) on delete cascade,
  input text not null default '',
  expected_output text not null,
  hidden boolean not null default true,
  points integer not null default 10 check (points between 0 and 100),
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now(),
  unique (problem_id, order_index)
);

create table if not exists public.oj_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.oj_problems(id) on delete cascade,
  language text not null check (language in ('cpp','java','python','javascript')),
  source_code text not null check (char_length(source_code) between 1 and 50000),
  verdict text not null default 'pending'
    check (verdict in ('pending','judging','accepted','wrong_answer','time_limit','compilation_error','runtime_error','system_error')),
  score integer not null default 0 check (score between 0 and 100),
  passed_count integer not null default 0 check (passed_count >= 0),
  test_count integer not null default 0 check (test_count >= 0),
  max_time_ms integer check (max_time_ms is null or max_time_ms >= 0),
  max_memory_kb integer check (max_memory_kb is null or max_memory_kb >= 0),
  compile_output text,
  error_message text,
  judged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oj_submission_cases (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.oj_submissions(id) on delete cascade,
  order_index integer not null check (order_index >= 0),
  verdict text not null
    check (verdict in ('accepted','wrong_answer','time_limit','compilation_error','runtime_error','system_error')),
  time_ms integer check (time_ms is null or time_ms >= 0),
  memory_kb integer check (memory_kb is null or memory_kb >= 0),
  message text,
  unique (submission_id, order_index)
);

create index if not exists oj_problems_status_difficulty_idx
  on public.oj_problems (status, difficulty, created_at desc);
create index if not exists oj_submissions_user_date_idx
  on public.oj_submissions (user_id, created_at desc);
create index if not exists oj_submissions_problem_verdict_idx
  on public.oj_submissions (problem_id, verdict, created_at desc);

alter table public.oj_problems enable row level security;
alter table public.oj_test_cases enable row level security;
alter table public.oj_submissions enable row level security;
alter table public.oj_submission_cases enable row level security;

drop policy if exists "oj_published_problems_read" on public.oj_problems;
create policy "oj_published_problems_read"
  on public.oj_problems for select
  using (auth.uid() is not null and status = 'published' and not public.is_user_banned(auth.uid()));

-- There is intentionally no member policy on oj_test_cases. Public samples are
-- selected server-side and hidden cases/answers never reach the browser.
drop policy if exists "oj_own_submissions_read" on public.oj_submissions;
create policy "oj_own_submissions_read"
  on public.oj_submissions for select
  using (auth.uid() = user_id and not public.is_user_banned(auth.uid()));
drop policy if exists "oj_own_submission_cases_read" on public.oj_submission_cases;
create policy "oj_own_submission_cases_read"
  on public.oj_submission_cases for select
  using (
    exists (
      select 1 from public.oj_submissions s
      where s.id = submission_id and s.user_id = auth.uid()
    )
    and not public.is_user_banned(auth.uid())
  );

revoke all on public.oj_test_cases from anon, authenticated;
revoke insert, update, delete on public.oj_problems from anon, authenticated;
revoke insert, update, delete on public.oj_submissions from anon, authenticated;
revoke insert, update, delete on public.oj_submission_cases from anon, authenticated;
grant select on public.oj_problems, public.oj_submissions, public.oj_submission_cases to authenticated;

drop trigger if exists reject_banned_oj_submission_write on public.oj_submissions;
create trigger reject_banned_oj_submission_write
  before insert on public.oj_submissions
  for each row execute function public.reject_banned_user_write();

create or replace function public.complete_oj_submission(
  p_submission_id uuid,
  p_verdict text,
  p_score integer,
  p_passed_count integer,
  p_test_count integer,
  p_max_time_ms integer,
  p_max_memory_kb integer,
  p_compile_output text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_problem_id uuid;
begin
  if p_verdict not in ('accepted','wrong_answer','time_limit','compilation_error','runtime_error','system_error') then
    raise exception 'invalid judge verdict';
  end if;
  update public.oj_submissions
  set verdict = p_verdict,
      score = least(greatest(coalesce(p_score, 0), 0), 100),
      passed_count = greatest(coalesce(p_passed_count, 0), 0),
      test_count = greatest(coalesce(p_test_count, 0), 0),
      max_time_ms = p_max_time_ms,
      max_memory_kb = p_max_memory_kb,
      compile_output = left(p_compile_output, 8000),
      error_message = left(p_error_message, 2000),
      judged_at = now(),
      updated_at = now()
  where id = p_submission_id and verdict in ('pending','judging')
  returning problem_id into v_problem_id;
  if not found then return false; end if;

  update public.oj_problems
  set submission_count = submission_count + 1,
      accepted_count = accepted_count + case when p_verdict = 'accepted' then 1 else 0 end,
      updated_at = now()
  where id = v_problem_id;
  return true;
end;
$$;

revoke all on function public.complete_oj_submission(uuid,text,integer,integer,integer,integer,integer,text,text)
  from public, anon, authenticated;
grant execute on function public.complete_oj_submission(uuid,text,integer,integer,integer,integer,integer,text,text)
  to service_role;

do $$
declare
  v_problem_id uuid;
begin
  insert into public.oj_problems (
    slug, title, statement, input_description, output_description, constraints_text,
    difficulty, grade_level, time_limit_ms, memory_limit_kb, status
  ) values (
    'a-plus-b',
    'A + B',
    E'두 정수 A와 B가 주어질 때, A+B를 출력하세요.',
    E'첫째 줄에 두 정수 A와 B가 공백으로 구분되어 주어집니다.',
    E'첫째 줄에 A+B를 출력합니다.',
    E'-1,000,000 ≤ A, B ≤ 1,000,000',
    1, null, 1000, 128000, 'published'
  )
  on conflict (slug) do nothing;
  select id into v_problem_id from public.oj_problems where slug = 'a-plus-b';
  if not exists (select 1 from public.oj_test_cases where problem_id = v_problem_id) then
    insert into public.oj_test_cases (problem_id, input, expected_output, hidden, points, order_index) values
      (v_problem_id, E'1 2\n', E'3\n', false, 20, 0),
      (v_problem_id, E'-5 8\n', E'3\n', true, 40, 1),
      (v_problem_id, E'1000000 -1000000\n', E'0\n', true, 40, 2);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'oj_submissions'
  ) then
    alter publication supabase_realtime add table public.oj_submissions;
  end if;
end $$;
alter table public.oj_submissions replica identity full;

notify pgrst, 'reload schema';
