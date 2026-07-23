-- Rated 1:1 battles for fixed-input/output-answer problems.
-- Expected outputs stay in oj_test_cases and are never exposed by these RPCs.

create table if not exists public.coding_battle_matches (
  id uuid primary key default gen_random_uuid(),
  grade_level text not null check (
    grade_level in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')
  ),
  problem_id uuid not null references public.oj_problems(id) on delete restrict,
  status text not null default 'waiting' check (status in ('waiting','active','completed','cancelled')),
  player1_id uuid not null references auth.users(id) on delete cascade,
  player2_id uuid references auth.users(id) on delete cascade,
  player1_correct boolean,
  player2_correct boolean,
  player1_response_ms integer check (player1_response_ms is null or player1_response_ms between 0 and 900000),
  player2_response_ms integer check (player2_response_ms is null or player2_response_ms between 0 and 900000),
  player1_submitted_at timestamptz,
  player2_submitted_at timestamptz,
  player1_rating_before integer,
  player2_rating_before integer,
  player1_rating_after integer,
  player2_rating_after integer,
  winner_id uuid references auth.users(id) on delete set null,
  rating_battle_match_id uuid references public.battle_matches(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  expires_at timestamptz not null default (now() + interval '3 minutes'),
  finished_at timestamptz,
  constraint coding_battle_players_different check (player2_id is null or player1_id <> player2_id)
);

create index if not exists coding_battle_waiting_idx
  on public.coding_battle_matches (grade_level, created_at)
  where status = 'waiting';
create index if not exists coding_battle_player1_idx
  on public.coding_battle_matches (player1_id, created_at desc);
create index if not exists coding_battle_player2_idx
  on public.coding_battle_matches (player2_id, created_at desc);

alter table public.coding_battle_matches enable row level security;
drop policy if exists "coding_battle_participant_read" on public.coding_battle_matches;
create policy "coding_battle_participant_read"
  on public.coding_battle_matches for select
  using (
    not public.is_user_banned(auth.uid())
    and auth.uid() in (player1_id, player2_id)
  );

revoke insert, update, delete on public.coding_battle_matches from anon, authenticated;
grant select on public.coding_battle_matches to authenticated;

create or replace function public.prevent_parallel_battle_modes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'battle_matches'
     and new.status in ('waiting','active')
     and coalesce(new.question_keys ->> 0, '') not like 'output-judge:%'
     and exists (
       select 1 from public.coding_battle_matches c
       where c.status in ('waiting','active')
         and (
           c.player1_id in (new.player1_id, new.player2_id)
           or c.player2_id in (new.player1_id, new.player2_id)
         )
     ) then
    raise exception 'another coding battle is active';
  end if;

  if tg_table_name = 'coding_battle_matches'
     and new.status in ('waiting','active')
     and exists (
       select 1 from public.battle_matches b
       where b.status in ('waiting','active')
         and coalesce(b.question_keys ->> 0, '') not like 'output-judge:%'
         and (
           b.player1_id in (new.player1_id, new.player2_id)
           or b.player2_id in (new.player1_id, new.player2_id)
         )
     ) then
    raise exception 'another battle is active';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_parallel_standard_battle on public.battle_matches;
create trigger prevent_parallel_standard_battle
  before insert or update of status, player1_id, player2_id on public.battle_matches
  for each row execute function public.prevent_parallel_battle_modes();
drop trigger if exists prevent_parallel_coding_battle on public.coding_battle_matches;
create trigger prevent_parallel_coding_battle
  before insert or update of status, player1_id, player2_id on public.coding_battle_matches
  for each row execute function public.prevent_parallel_battle_modes();

create or replace function public.finalize_coding_battle_locked(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.coding_battle_matches%rowtype;
  v_problem_title text;
  v_score1 integer;
  v_score2 integer;
  v_rating_match_id uuid;
  v_rating_match public.battle_matches%rowtype;
begin
  select * into m
  from public.coding_battle_matches
  where id = p_match_id
  for update;

  if not found or m.status <> 'active' then return false; end if;
  if (m.player1_submitted_at is null or m.player2_submitted_at is null)
     and m.expires_at > now() then
    return false;
  end if;
  if m.player2_id is null then
    update public.coding_battle_matches
    set status = 'cancelled', finished_at = now()
    where id = m.id;
    return true;
  end if;

  -- Accepted outputs beat wrong/unsubmitted outputs. When both are accepted,
  -- the faster response wins. Equal results are rated as a draw.
  v_score1 := case
    when m.player1_correct is true then 1000000 - coalesce(m.player1_response_ms, 900000)
    else 0
  end;
  v_score2 := case
    when m.player2_correct is true then 1000000 - coalesce(m.player2_response_ms, 900000)
    else 0
  end;

  insert into public.battle_matches (
    grade_level, subject_id, status, player1_id, player2_id, question_keys,
    player1_score, player2_score, player1_answered, player2_answered,
    player1_rating_before, player2_rating_before, started_at, expires_at
  ) values (
    m.grade_level, 'math', 'active', m.player1_id, m.player2_id,
    jsonb_build_array(
      'output-judge:' || m.problem_id || ':1', 'output-judge:' || m.problem_id || ':2',
      'output-judge:' || m.problem_id || ':3', 'output-judge:' || m.problem_id || ':4',
      'output-judge:' || m.problem_id || ':5'
    ),
    v_score1, v_score2, 5, 5,
    m.player1_rating_before, m.player2_rating_before, m.started_at, now()
  )
  returning id into v_rating_match_id;

  select title into v_problem_title from public.oj_problems where id = m.problem_id;
  perform set_config(
    'studyhub.rating_reason',
    format('Output Judge 배틀 · %s', coalesce(v_problem_title, 'Coding Problem')),
    true
  );
  perform public.finalize_battle_locked(v_rating_match_id);
  select * into v_rating_match from public.battle_matches where id = v_rating_match_id;

  update public.battle_rating_history
  set source = 'coding_battle',
      event_type = 'coding_battle',
      event_id = m.id,
      event_title = format(
        'Output Judge · %s',
        coalesce(v_problem_title, 'Coding Problem')
      ),
      reason = format('Output Judge 배틀 · %s', coalesce(v_problem_title, 'Coding Problem'))
  where event_type = 'battle' and event_id = v_rating_match_id;

  update public.coding_battle_matches
  set status = 'completed',
      finished_at = now(),
      winner_id = v_rating_match.winner_id,
      player1_rating_after = v_rating_match.player1_rating_after,
      player2_rating_after = v_rating_match.player2_rating_after,
      rating_battle_match_id = v_rating_match_id
  where id = m.id;
  return true;
end;
$$;

revoke all on function public.finalize_coding_battle_locked(uuid)
  from public, anon, authenticated;

create or replace function public.join_coding_battle_queue(p_grade_level text)
returns table(match_id uuid, match_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match public.coding_battle_matches%rowtype;
  v_problem_id uuid;
  v_rating integer;
  v_opponent_rating integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if public.is_user_banned(v_user) then raise exception 'banned user'; end if;
  if p_grade_level not in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')
     or not exists (
       select 1 from public.profiles where id = v_user and grade_level = p_grade_level
     ) then
    raise exception 'battle grade must match profile grade';
  end if;

  perform public.finalize_coding_battle_locked(id)
  from public.coding_battle_matches
  where status = 'active'
    and expires_at <= now()
    and v_user in (player1_id, player2_id);

  update public.coding_battle_matches
  set status = 'cancelled', finished_at = now()
  where status = 'waiting' and expires_at <= now();

  select * into v_match
  from public.coding_battle_matches
  where status in ('waiting','active')
    and v_user in (player1_id, player2_id)
  order by created_at desc
  limit 1;
  if found then
    return query select v_match.id, v_match.status;
    return;
  end if;

  if exists (
    select 1 from public.battle_matches
    where status in ('waiting','active') and v_user in (player1_id, player2_id)
  ) then
    raise exception 'another battle is active';
  end if;

  insert into public.battle_ratings (user_id) values (v_user)
  on conflict (user_id) do nothing;
  select rating into v_rating from public.battle_ratings where user_id = v_user;

  select * into v_match
  from public.coding_battle_matches
  where status = 'waiting'
    and grade_level = p_grade_level
    and player1_id <> v_user
    and expires_at > now()
  order by created_at
  for update skip locked
  limit 1;

  if found then
    insert into public.battle_ratings (user_id) values (v_match.player1_id)
    on conflict (user_id) do nothing;
    select rating into v_opponent_rating
    from public.battle_ratings where user_id = v_match.player1_id;

    update public.coding_battle_matches
    set player2_id = v_user,
        player2_rating_before = v_rating,
        player1_rating_before = v_opponent_rating,
        status = 'active',
        started_at = now(),
        expires_at = now() + interval '10 minutes'
    where id = v_match.id
    returning * into v_match;
    return query select v_match.id, v_match.status;
    return;
  end if;

  select p.id into v_problem_id
  from public.oj_problems p
  where p.status = 'published'
    and (p.grade_level is null or p.grade_level = p_grade_level)
    and exists (
      select 1 from public.oj_test_cases t
      where t.problem_id = p.id and t.order_index = 0
    )
  order by random()
  limit 1;
  if v_problem_id is null then raise exception 'no published judge problem'; end if;

  insert into public.coding_battle_matches (
    grade_level, problem_id, player1_id, player1_rating_before, expires_at
  ) values (
    p_grade_level, v_problem_id, v_user, v_rating, now() + interval '3 minutes'
  )
  returning * into v_match;
  return query select v_match.id, v_match.status;
end;
$$;

revoke all on function public.join_coding_battle_queue(text) from public, anon;
grant execute on function public.join_coding_battle_queue(text) to authenticated;

create or replace function public.record_coding_battle_output(
  p_user_id uuid,
  p_match_id uuid,
  p_is_correct boolean,
  p_response_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.coding_battle_matches%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  select * into m
  from public.coding_battle_matches
  where id = p_match_id
  for update;
  if not found or m.status <> 'active'
     or p_user_id not in (m.player1_id, m.player2_id) then
    raise exception 'active coding battle not found';
  end if;
  if m.expires_at <= now() then
    perform public.finalize_coding_battle_locked(m.id);
    raise exception 'coding battle expired';
  end if;

  if p_user_id = m.player1_id then
    if m.player1_submitted_at is not null then raise exception 'output already submitted'; end if;
    update public.coding_battle_matches
    set player1_correct = p_is_correct,
        -- Server elapsed time is authoritative; the client value is retained in
        -- the RPC signature only for forward-compatible telemetry.
        player1_response_ms = least(greatest(
          round(extract(epoch from (now() - m.started_at)) * 1000)::integer,
          0
        ), 900000),
        player1_submitted_at = now()
    where id = m.id;
  else
    if m.player2_submitted_at is not null then raise exception 'output already submitted'; end if;
    update public.coding_battle_matches
    set player2_correct = p_is_correct,
        player2_response_ms = least(greatest(
          round(extract(epoch from (now() - m.started_at)) * 1000)::integer,
          0
        ), 900000),
        player2_submitted_at = now()
    where id = m.id;
  end if;

  return public.finalize_coding_battle_locked(m.id);
end;
$$;

revoke all on function public.record_coding_battle_output(uuid,uuid,boolean,integer)
  from public, anon, authenticated;
grant execute on function public.record_coding_battle_output(uuid,uuid,boolean,integer)
  to service_role;

create or replace function public.finalize_coding_battle(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.coding_battle_matches
    where id = p_match_id and auth.uid() in (player1_id, player2_id)
  ) then
    raise exception 'coding battle not found';
  end if;
  return public.finalize_coding_battle_locked(p_match_id);
end;
$$;

revoke all on function public.finalize_coding_battle(uuid) from public, anon;
grant execute on function public.finalize_coding_battle(uuid) to authenticated;

create or replace function public.cancel_waiting_coding_battle(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coding_battle_matches
  set status = 'cancelled', finished_at = now()
  where id = p_match_id and status = 'waiting' and player1_id = auth.uid();
end;
$$;

revoke all on function public.cancel_waiting_coding_battle(uuid) from public, anon;
grant execute on function public.cancel_waiting_coding_battle(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'coding_battle_matches'
  ) then
    alter publication supabase_realtime add table public.coding_battle_matches;
  end if;
exception
  when undefined_object then null;
end $$;

alter table public.coding_battle_matches replica identity full;
notify pgrst, 'reload schema';
