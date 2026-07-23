-- Developer console metadata. All writes are performed by server actions only
-- after an admin-role check, using the service role.

alter table public.questions
  add column if not exists grade_level text,
  add column if not exists unit_name text,
  add column if not exists status text not null default 'published',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.questions
  drop constraint if exists questions_grade_level_check,
  add constraint questions_grade_level_check check (
    grade_level is null or grade_level in (
      '초1','초2','초3','초4','초5','초6',
      '중1','중2','중3','고1','고2','고3'
    )
  ),
  drop constraint if exists questions_status_check,
  add constraint questions_status_check check (status in ('draft', 'published', 'archived')),
  drop constraint if exists questions_difficulty_check,
  add constraint questions_difficulty_check check (difficulty between 1 and 5);

create index if not exists questions_developer_filter_idx
  on public.questions (status, grade_level, subject_id, created_at desc);

alter table public.contests
  add column if not exists publication_status text not null default 'published',
  add column if not exists updated_at timestamptz not null default now();

alter table public.contests
  drop constraint if exists contests_publication_status_check,
  add constraint contests_publication_status_check
    check (publication_status in ('draft', 'published', 'cancelled'));

create table if not exists public.developer_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists developer_audit_logs_date_idx
  on public.developer_audit_logs (created_at desc);

alter table public.developer_audit_logs enable row level security;

-- Developer-authored questions contain contest answers. Normal members receive
-- them only through answer-stripped server actions, never through direct REST.
drop policy if exists "questions_read_all" on public.questions;
create policy "questions_read_authenticated" on public.questions for select using (
  auth.role() = 'authenticated'
  and (
    source not like 'developer%'
    or public.is_admin()
  )
);

-- Draft/cancelled contests stay invisible to normal members.
drop policy if exists "contests_read_authenticated" on public.contests;
create policy "contests_read_authenticated" on public.contests for select using (
  auth.uid() is not null
  and (
    publication_status = 'published'
    or public.is_admin()
  )
);

create or replace function public.record_contest_answer(
  p_user_id uuid, p_contest_id uuid, p_question_key text, p_user_answer text, p_is_correct boolean
)
returns table(current_score integer, current_solved integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests%rowtype;
  e public.contest_entries%rowtype;
  v_count integer;
begin
  select * into c from public.contests where id = p_contest_id for update;
  if not found or c.publication_status <> 'published'
    or now() < c.starts_at or now() > c.ends_at then
    raise exception 'contest is not active';
  end if;
  if not exists (
    select 1 from public.profiles where id = p_user_id and grade_level = c.grade_level
  ) then raise exception 'grade mismatch'; end if;
  if not (c.question_keys ? p_question_key) or length(p_user_answer) > 500 then
    raise exception 'invalid contest answer';
  end if;
  if exists (
    select 1 from public.contest_answers
    where contest_id = c.id and user_id = p_user_id and question_key = p_question_key
  ) then raise exception 'question already answered'; end if;

  insert into public.contest_entries (contest_id, user_id) values (c.id, p_user_id)
  on conflict (contest_id, user_id) do nothing;
  insert into public.contest_answers (contest_id, user_id, question_key, user_answer, is_correct)
  values (c.id, p_user_id, p_question_key, p_user_answer, p_is_correct);
  update public.contest_entries set
    score = score + case when p_is_correct then 100 else 0 end,
    solved = solved + case when p_is_correct then 1 else 0 end,
    penalty_seconds = penalty_seconds + case when p_is_correct
      then greatest(0, extract(epoch from (now() - c.starts_at))::integer)
      else 0
    end
  where contest_id = c.id and user_id = p_user_id returning * into e;
  select count(*) into v_count from public.contest_answers
    where contest_id = c.id and user_id = p_user_id;
  if v_count >= jsonb_array_length(c.question_keys) then
    update public.contest_entries set finished_at = now() where id = e.id;
  end if;
  return query select e.score, e.solved;
end;
$$;

revoke all on function public.record_contest_answer(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_contest_answer(uuid, uuid, text, text, boolean) to service_role;

notify pgrst, 'reload schema';
