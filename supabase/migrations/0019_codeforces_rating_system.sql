-- Codeforces-style rating: expected seed -> geometric mean rank -> performance rating
-- -> field-wide inflation correction. New accounts use a six-event confidence ramp.

alter table public.battle_ratings
  add column if not exists rated_events integer not null default 0 check (rated_events >= 0);

update public.battle_ratings
set rated_events = games
where rated_events = 0 and games > 0;

alter table public.battle_matches
  add column if not exists player1_expected_rank double precision,
  add column if not exists player2_expected_rank double precision,
  add column if not exists player1_actual_rank double precision,
  add column if not exists player2_actual_rank double precision,
  add column if not exists player1_performance_rating integer,
  add column if not exists player2_performance_rating integer,
  add column if not exists player1_base_delta integer,
  add column if not exists player2_base_delta integer,
  add column if not exists player1_correction integer,
  add column if not exists player2_correction integer,
  add column if not exists player1_provisional_factor numeric(4,2),
  add column if not exists player2_provisional_factor numeric(4,2);

alter table public.battle_rating_history
  add column if not exists event_type text,
  add column if not exists event_id uuid,
  add column if not exists expected_rank double precision,
  add column if not exists actual_rank double precision,
  add column if not exists performance_rating integer,
  add column if not exists base_delta integer,
  add column if not exists correction integer,
  add column if not exists provisional_factor numeric(4,2);

create index if not exists battle_rating_history_event_idx
  on public.battle_rating_history (event_type, event_id);

alter table public.contests
  add column if not exists is_rated boolean not null default true,
  add column if not exists ratings_finalized_at timestamptz;

alter table public.contest_entries
  add column if not exists final_rank double precision,
  add column if not exists rating_before integer,
  add column if not exists rating_after integer,
  add column if not exists rating_change integer;

create table if not exists public.contest_rating_changes (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating_before integer not null,
  rating_after integer not null,
  rating_change integer not null default 0,
  expected_rank double precision not null,
  actual_rank double precision not null,
  performance_rating integer not null,
  base_delta integer not null,
  correction integer not null default 0,
  provisional_factor numeric(4,2) not null default 1,
  created_at timestamptz not null default now(),
  unique (contest_id, user_id)
);

alter table public.contest_rating_changes enable row level security;
drop policy if exists "contest_rating_changes_read_authenticated" on public.contest_rating_changes;
create policy "contest_rating_changes_read_authenticated"
  on public.contest_rating_changes for select using (auth.uid() is not null);

create or replace function public.cf_win_probability(p_rating_a double precision, p_rating_b double precision)
returns double precision
language sql
immutable
as $$
  select 1.0 / (1.0 + power(10.0, (p_rating_b - p_rating_a) / 400.0));
$$;

create or replace function public.cf_expected_rank(p_candidate_rating double precision, p_opponent_ratings integer[])
returns double precision
language plpgsql
immutable
as $$
declare
  v_opponent integer;
  v_seed double precision := 1.0;
begin
  foreach v_opponent in array p_opponent_ratings loop
    v_seed := v_seed + public.cf_win_probability(v_opponent, p_candidate_rating);
  end loop;
  return v_seed;
end;
$$;

create or replace function public.cf_performance_rating(p_target_rank double precision, p_opponent_ratings integer[])
returns integer
language plpgsql
immutable
as $$
declare
  v_low double precision := 100;
  v_high double precision := 5000;
  v_middle double precision;
  v_iteration integer;
begin
  for v_iteration in 1..40 loop
    v_middle := (v_low + v_high) / 2.0;
    if public.cf_expected_rank(v_middle, p_opponent_ratings) < p_target_rank then
      v_high := v_middle;
    else
      v_low := v_middle;
    end if;
  end loop;
  return round((v_low + v_high) / 2.0)::integer;
end;
$$;

create or replace function public.cf_provisional_factor(p_rated_events integer)
returns numeric
language sql
immutable
as $$
  select case least(greatest(coalesce(p_rated_events, 0), 0), 5)
    when 0 then 2.00
    when 1 then 1.75
    when 2 then 1.50
    when 3 then 1.30
    when 4 then 1.15
    else 1.00
  end;
$$;

-- Replaces the old fixed K=32 settlement with the same seed/performance principle
-- used by Codeforces. The row lock keeps each match strictly idempotent.
create or replace function public.finalize_battle_locked(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.battle_matches%rowtype;
  br1 public.battle_ratings%rowtype;
  br2 public.battle_ratings%rowtype;
  v_opponents1 integer[];
  v_opponents2 integer[];
  v_result1 double precision;
  v_actual1 double precision;
  v_actual2 double precision;
  v_seed1 double precision;
  v_seed2 double precision;
  v_perf1 integer;
  v_perf2 integer;
  v_base1 integer;
  v_base2 integer;
  v_factor1 numeric;
  v_factor2 numeric;
  v_adjusted1 integer;
  v_adjusted2 integer;
  v_first_correction integer;
  v_top_correction integer;
  v_delta1 integer;
  v_delta2 integer;
  v_n1 integer;
  v_n2 integer;
begin
  select * into m from public.battle_matches where id = p_match_id for update;
  if not found or m.status <> 'active' then return false; end if;
  if (m.player1_answered < 5 or m.player2_answered < 5)
    and coalesce(m.expires_at, now() + interval '1 minute') > now() then
    return false;
  end if;

  insert into public.battle_ratings (user_id) values (m.player1_id) on conflict (user_id) do nothing;
  insert into public.battle_ratings (user_id) values (m.player2_id) on conflict (user_id) do nothing;

  -- Always lock in UUID order to avoid two simultaneous settlements deadlocking.
  perform 1 from public.battle_ratings
    where user_id in (m.player1_id, m.player2_id) order by user_id for update;
  select * into br1 from public.battle_ratings where user_id = m.player1_id;
  select * into br2 from public.battle_ratings where user_id = m.player2_id;

  v_result1 := case
    when m.player1_score > m.player2_score then 1.0
    when m.player1_score < m.player2_score then 0.0
    else 0.5
  end;
  v_actual1 := case when v_result1 = 1 then 1.0 when v_result1 = 0 then 2.0 else 1.5 end;
  v_actual2 := case when v_result1 = 0 then 1.0 when v_result1 = 1 then 2.0 else 1.5 end;
  v_opponents1 := array[br2.rating];
  v_opponents2 := array[br1.rating];

  v_seed1 := public.cf_expected_rank(br1.rating, v_opponents1);
  v_seed2 := public.cf_expected_rank(br2.rating, v_opponents2);
  v_perf1 := public.cf_performance_rating(sqrt(v_seed1 * v_actual1), v_opponents1);
  v_perf2 := public.cf_performance_rating(sqrt(v_seed2 * v_actual2), v_opponents2);
  v_base1 := round((v_perf1 - br1.rating) / 2.0)::integer;
  v_base2 := round((v_perf2 - br2.rating) / 2.0)::integer;
  v_factor1 := public.cf_provisional_factor(br1.rated_events);
  v_factor2 := public.cf_provisional_factor(br2.rated_events);
  v_adjusted1 := round(v_base1 * v_factor1)::integer;
  v_adjusted2 := round(v_base2 * v_factor2)::integer;

  v_first_correction := round(-(v_adjusted1 + v_adjusted2) / 2.0)::integer - 1;
  v_adjusted1 := v_adjusted1 + v_first_correction;
  v_adjusted2 := v_adjusted2 + v_first_correction;
  v_top_correction := greatest(-10, least(0, round(-(v_adjusted1 + v_adjusted2) / 2.0)::integer));
  v_delta1 := greatest(-250, least(250, v_adjusted1 + v_top_correction));
  v_delta2 := greatest(-250, least(250, v_adjusted2 + v_top_correction));
  v_n1 := greatest(100, least(5000, br1.rating + v_delta1));
  v_n2 := greatest(100, least(5000, br2.rating + v_delta2));
  v_delta1 := v_n1 - br1.rating;
  v_delta2 := v_n2 - br2.rating;

  update public.battle_ratings set
    rating = v_n1, peak_rating = greatest(peak_rating, v_n1), games = games + 1,
    rated_events = rated_events + 1,
    wins = wins + case when v_result1 = 1 then 1 else 0 end,
    losses = losses + case when v_result1 = 0 then 1 else 0 end,
    draws = draws + case when v_result1 = 0.5 then 1 else 0 end,
    updated_at = now()
  where user_id = m.player1_id;

  update public.battle_ratings set
    rating = v_n2, peak_rating = greatest(peak_rating, v_n2), games = games + 1,
    rated_events = rated_events + 1,
    wins = wins + case when v_result1 = 0 then 1 else 0 end,
    losses = losses + case when v_result1 = 1 then 1 else 0 end,
    draws = draws + case when v_result1 = 0.5 then 1 else 0 end,
    updated_at = now()
  where user_id = m.player2_id;

  update public.battle_rating_history set
    source = 'battle', event_type = 'battle', event_id = m.id,
    expected_rank = v_seed1, actual_rank = v_actual1,
    performance_rating = v_perf1, base_delta = v_base1,
    correction = v_delta1 - round(v_base1 * v_factor1)::integer,
    provisional_factor = v_factor1
  where id = (
    select id from public.battle_rating_history
    where user_id = m.player1_id and event_id is null
      and rating_change = v_delta1 and created_at >= transaction_timestamp()
    order by created_at desc, id desc limit 1
  );

  update public.battle_rating_history set
    source = 'battle', event_type = 'battle', event_id = m.id,
    expected_rank = v_seed2, actual_rank = v_actual2,
    performance_rating = v_perf2, base_delta = v_base2,
    correction = v_delta2 - round(v_base2 * v_factor2)::integer,
    provisional_factor = v_factor2
  where id = (
    select id from public.battle_rating_history
    where user_id = m.player2_id and event_id is null
      and rating_change = v_delta2 and created_at >= transaction_timestamp()
    order by created_at desc, id desc limit 1
  );

  update public.battle_matches set
    status = 'completed',
    finished_at = now(),
    winner_id = case
      when v_result1 = 1 then m.player1_id
      when v_result1 = 0 then m.player2_id
      else null
    end,
    player1_rating_after = v_n1,
    player2_rating_after = v_n2,
    player1_expected_rank = v_seed1,
    player2_expected_rank = v_seed2,
    player1_actual_rank = v_actual1,
    player2_actual_rank = v_actual2,
    player1_performance_rating = v_perf1,
    player2_performance_rating = v_perf2,
    player1_base_delta = v_base1,
    player2_base_delta = v_base2,
    player1_correction = v_delta1 - round(v_base1 * v_factor1)::integer,
    player2_correction = v_delta2 - round(v_base2 * v_factor2)::integer,
    player1_provisional_factor = v_factor1,
    player2_provisional_factor = v_factor2
  where id = m.id;

  return true;
end;
$$;

revoke all on function public.finalize_battle_locked(uuid) from public, anon, authenticated;

-- Finalizes all contest participants in one locked transaction.
create or replace function public.finalize_contest_ratings(p_contest_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests%rowtype;
  v_opponent_ratings integer[];
  v_seed double precision;
  v_count integer;
  v_first_correction integer;
  v_top_count integer;
  v_top_sum integer;
  v_top_correction integer;
  v_after integer;
  participant record;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'authentication required';
  end if;

  select * into c from public.contests where id = p_contest_id for update;
  if not found or c.ratings_finalized_at is not null then return false; end if;
  if now() <= c.ends_at then return false; end if;

  select count(*) into v_count from public.contest_entries where contest_id = c.id;
  if not c.is_rated or v_count < 2 then
    update public.contests set ratings_finalized_at = now() where id = c.id;
    return true;
  end if;

  insert into public.battle_ratings (user_id)
    select user_id from public.contest_entries where contest_id = c.id
  on conflict (user_id) do nothing;

  perform 1 from public.battle_ratings
    where user_id in (select user_id from public.contest_entries where contest_id = c.id)
    order by user_id for update;

  for participant in
    select ranked.user_id, ranked.rating, ranked.rated_events, ranked.actual_rank
    from (
      select e.user_id, r.rating, r.rated_events,
        rank() over (order by e.score desc, e.penalty_seconds asc)::double precision as actual_rank
      from public.contest_entries e
      join public.battle_ratings r on r.user_id = e.user_id
      where e.contest_id = c.id
    ) ranked
  loop
    select array_agg(r.rating order by e.user_id)
    into v_opponent_ratings
    from public.contest_entries e
    join public.battle_ratings r on r.user_id = e.user_id
    where e.contest_id = c.id and e.user_id <> participant.user_id;

    v_seed := public.cf_expected_rank(participant.rating, v_opponent_ratings);

    insert into public.contest_rating_changes (
      contest_id, user_id, rating_before, rating_after, expected_rank, actual_rank,
      performance_rating, base_delta, provisional_factor, rating_change
    )
    select c.id, participant.user_id, participant.rating, participant.rating,
      v_seed, participant.actual_rank, calculated.performance,
      round((calculated.performance - participant.rating) / 2.0)::integer,
      public.cf_provisional_factor(participant.rated_events),
      round(
        round((calculated.performance - participant.rating) / 2.0)
        * public.cf_provisional_factor(participant.rated_events)
      )::integer
    from (
      select public.cf_performance_rating(
        sqrt(v_seed * participant.actual_rank), v_opponent_ratings
      ) as performance
    ) calculated
    on conflict (contest_id, user_id) do nothing;
  end loop;

  select round(-coalesce(sum(rating_change), 0) / v_count::numeric)::integer - 1
  into v_first_correction
  from public.contest_rating_changes where contest_id = c.id;

  update public.contest_rating_changes set
    rating_change = rating_change + v_first_correction,
    correction = correction + v_first_correction
  where contest_id = c.id;

  v_top_count := least(v_count, greatest(1, round(4 * sqrt(v_count::numeric))::integer));
  select coalesce(sum(top_participant.rating_change), 0) into v_top_sum
  from (
    select rating_change from public.contest_rating_changes
    where contest_id = c.id
    order by rating_before desc
    limit v_top_count
  ) top_participant;
  v_top_correction := greatest(
    -10,
    least(0, round(-v_top_sum / v_top_count::numeric)::integer)
  );

  update public.contest_rating_changes set
    rating_change = greatest(-250, least(250, rating_change + v_top_correction)),
    correction = correction + v_top_correction
  where contest_id = c.id;

  for participant in
    select * from public.contest_rating_changes where contest_id = c.id order by user_id
  loop
    v_after := greatest(100, least(5000, participant.rating_before + participant.rating_change));

    update public.contest_rating_changes set
      rating_after = v_after,
      rating_change = v_after - participant.rating_before
    where id = participant.id;

    update public.battle_ratings set
      rating = v_after,
      peak_rating = greatest(peak_rating, v_after),
      rated_events = rated_events + 1,
      updated_at = now()
    where user_id = participant.user_id;

    update public.battle_rating_history set
      source = 'contest', event_type = 'contest', event_id = c.id,
      expected_rank = participant.expected_rank,
      actual_rank = participant.actual_rank,
      performance_rating = participant.performance_rating,
      base_delta = participant.base_delta,
      correction = (v_after - participant.rating_before)
        - round(participant.base_delta * participant.provisional_factor)::integer,
      provisional_factor = participant.provisional_factor
    where id = (
      select id from public.battle_rating_history
      where user_id = participant.user_id and event_id is null
        and rating_change = v_after - participant.rating_before
        and created_at >= transaction_timestamp()
      order by created_at desc, id desc limit 1
    );

    update public.contest_entries set
      final_rank = participant.actual_rank,
      rating_before = participant.rating_before,
      rating_after = v_after,
      rating_change = v_after - participant.rating_before
    where contest_id = c.id and user_id = participant.user_id;
  end loop;

  update public.contests set ratings_finalized_at = now() where id = c.id;
  return true;
end;
$$;

revoke all on function public.finalize_contest_ratings(uuid) from public, anon;
grant execute on function public.finalize_contest_ratings(uuid) to authenticated, service_role;

drop function if exists public.get_contest_leaderboard(uuid, integer);
create function public.get_contest_leaderboard(p_contest_id uuid, p_limit integer default 100)
returns table(
  user_id uuid,
  nickname text,
  avatar_url text,
  rating integer,
  score integer,
  solved integer,
  penalty_seconds integer,
  finished_at timestamptz,
  final_rank double precision,
  rating_before integer,
  rating_after integer,
  rating_change integer
)
language sql
security definer
set search_path = public
as $$
  select e.user_id, p.nickname, p.avatar_url,
    coalesce(e.rating_after, r.rating, 1200),
    e.score, e.solved, e.penalty_seconds, e.finished_at,
    e.final_rank, e.rating_before, e.rating_after, e.rating_change
  from public.contest_entries e
  join public.profiles p on p.id = e.user_id
  left join public.battle_ratings r on r.user_id = e.user_id
  where e.contest_id = p_contest_id and auth.uid() is not null
  order by e.score desc, e.penalty_seconds asc, e.started_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

grant execute on function public.get_contest_leaderboard(uuid, integer) to authenticated;
