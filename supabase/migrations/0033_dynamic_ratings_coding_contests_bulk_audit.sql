-- Dynamic Rating ladder, editable contests, Output Judge contests and
-- evidence-preserving bulk Audit Log operations.

alter table public.app_settings
  add column if not exists rating_tiers jsonb;

create or replace function public.admin_set_rating_tiers(p_tiers jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_index integer;
  v_tier jsonb;
  v_previous_max integer := -1;
  v_min integer;
  v_max integer;
  v_name text;
  v_color text;
begin
  if not public.is_admin() then raise exception 'admin role required'; end if;
  if jsonb_typeof(p_tiers) <> 'array' then raise exception 'tiers must be an array'; end if;
  v_count := jsonb_array_length(p_tiers);
  if v_count < 2 or v_count > 40 then raise exception 'tier count must be 2 to 40'; end if;

  for v_index in 0..v_count - 1 loop
    v_tier := p_tiers -> v_index;
    v_min := (v_tier ->> 'min')::integer;
    v_max := (v_tier ->> 'max')::integer;
    v_name := trim(coalesce(v_tier ->> 'name', ''));
    v_color := lower(coalesce(v_tier ->> 'color', ''));
    if v_min <> v_previous_max + 1
      or v_max < v_min
      or v_min < 0
      or v_max > 5000
      or char_length(v_name) not between 2 and 40
      or v_color !~ '^#[0-9a-f]{6}$' then
      raise exception 'invalid or non-contiguous tier at index %', v_index;
    end if;
    v_previous_max := v_max;
  end loop;
  if v_previous_max <> 5000 then raise exception 'tiers must end at 5000'; end if;

  update public.app_settings
  set rating_tiers = p_tiers, updated_at = now()
  where id = true;
end;
$$;

revoke all on function public.admin_set_rating_tiers(jsonb) from public, anon;
grant execute on function public.admin_set_rating_tiers(jsonb) to authenticated;

alter table public.contests
  add column if not exists contest_mode text not null default 'quiz',
  add column if not exists judge_problem_ids uuid[] not null default '{}'::uuid[];

alter table public.contests
  drop constraint if exists contests_contest_mode_check;
alter table public.contests
  add constraint contests_contest_mode_check
  check (contest_mode in ('quiz', 'output_judge'));

-- Replace the legacy question count check so a coding contest can use its own
-- UUID array while retaining strict limits for quiz contests.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.contests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%jsonb_array_length(question_keys)%'
  loop
    execute format('alter table public.contests drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.contests
  add constraint contests_problem_configuration_check check (
    (
      contest_mode = 'quiz'
      and jsonb_typeof(question_keys) = 'array'
      and jsonb_array_length(question_keys) between 5 and 16
      and cardinality(judge_problem_ids) = 0
    )
    or
    (
      contest_mode = 'output_judge'
      and jsonb_typeof(question_keys) = 'array'
      and jsonb_array_length(question_keys) = 0
      and cardinality(judge_problem_ids) between 1 and 16
    )
  );

create table if not exists public.contest_judge_answers (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid not null references public.oj_problems(id) on delete restrict,
  submitted_output text not null check (char_length(submitted_output) between 1 and 50000),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (contest_id, user_id, problem_id)
);

create index if not exists contest_judge_answers_standing_idx
  on public.contest_judge_answers (contest_id, user_id, answered_at);
alter table public.contest_judge_answers enable row level security;
drop policy if exists "contest_judge_answers_select_own" on public.contest_judge_answers;
create policy "contest_judge_answers_select_own"
  on public.contest_judge_answers for select
  using (auth.uid() = user_id and not public.is_user_banned(auth.uid()));
revoke insert, update, delete on public.contest_judge_answers from anon, authenticated;
grant select on public.contest_judge_answers to authenticated;

create or replace function public.record_contest_judge_output(
  p_user_id uuid,
  p_contest_id uuid,
  p_problem_id uuid,
  p_submitted_output text,
  p_is_correct boolean
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
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  select * into c from public.contests where id = p_contest_id for update;
  if not found
    or c.publication_status <> 'published'
    or c.contest_mode <> 'output_judge'
    or now() < c.starts_at
    or now() > c.ends_at then
    raise exception 'coding contest is not active';
  end if;
  if public.is_user_banned(p_user_id) then raise exception 'banned user'; end if;
  if not p_problem_id = any(c.judge_problem_ids)
    or char_length(coalesce(p_submitted_output, '')) not between 1 and 50000 then
    raise exception 'invalid coding contest output';
  end if;
  select * into e from public.contest_entries
  where contest_id = c.id and user_id = p_user_id for update;
  if not found then raise exception 'contest registration required'; end if;
  if exists (
    select 1 from public.contest_judge_answers
    where contest_id = c.id and user_id = p_user_id and problem_id = p_problem_id
  ) then raise exception 'problem already answered'; end if;

  insert into public.contest_judge_answers (
    contest_id, user_id, problem_id, submitted_output, is_correct
  ) values (
    c.id, p_user_id, p_problem_id, p_submitted_output, p_is_correct
  );
  -- Keep the common contest participation/finalization path compatible.
  -- The public standings never expose the submitted output; this marker only
  -- records that the participant made a judged submission.
  insert into public.contest_answers (
    contest_id, user_id, question_key, user_answer, is_correct
  ) values (
    c.id, p_user_id, 'oj:' || p_problem_id::text, '[Output Judge]', p_is_correct
  );
  update public.contest_entries
  set score = score + case when p_is_correct then 100 else 0 end,
      solved = solved + case when p_is_correct then 1 else 0 end,
      penalty_seconds = penalty_seconds + case when p_is_correct
        then greatest(0, extract(epoch from (now() - c.starts_at))::integer)
        else 0
      end
  where id = e.id
  returning * into e;

  select count(*) into v_count
  from public.contest_judge_answers
  where contest_id = c.id and user_id = p_user_id;
  if v_count >= cardinality(c.judge_problem_ids) then
    update public.contest_entries set finished_at = now() where id = e.id;
  end if;
  return query select e.score, e.solved;
end;
$$;

revoke all on function public.record_contest_judge_output(uuid,uuid,uuid,text,boolean)
  from public, anon, authenticated;
grant execute on function public.record_contest_judge_output(uuid,uuid,uuid,text,boolean)
  to service_role;

create or replace function public.super_admin_bulk_audit_logs(
  p_audit_log_ids uuid[],
  p_action text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.is_super_admin() then raise exception 'super admin role required'; end if;
  if p_action not in ('archive', 'restore', 'delete')
    or cardinality(p_audit_log_ids) not between 1 and 100
    or char_length(v_reason) not between 5 and 500 then
    raise exception 'invalid bulk audit operation';
  end if;
  if cardinality(p_audit_log_ids) <> (
    select count(distinct item) from unnest(p_audit_log_ids) item
  ) then raise exception 'duplicate audit log ids'; end if;

  foreach v_id in array p_audit_log_ids loop
    if p_action = 'delete' then
      perform public.super_admin_delete_audit_log(v_id, v_reason);
    else
      perform public.super_admin_set_audit_log_archived(
        v_id,
        p_action = 'archive',
        v_reason
      );
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.super_admin_bulk_audit_logs(uuid[],text,text)
  from public, anon;
grant execute on function public.super_admin_bulk_audit_logs(uuid[],text,text)
  to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contest_judge_answers'
  ) then
    alter publication supabase_realtime add table public.contest_judge_answers;
  end if;
exception when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
