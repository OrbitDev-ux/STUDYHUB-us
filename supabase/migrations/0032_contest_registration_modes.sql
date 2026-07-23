-- Codeforces-style contest registration.
-- A published contest may allow Rating, while each participant independently
-- registers as rated or unrated before the contest starts.

alter table public.contest_entries
  add column if not exists participation_mode text,
  add column if not exists registered_at timestamptz;

update public.contest_entries e
set participation_mode = case when c.is_rated then 'rated' else 'unrated' end,
    registered_at = coalesce(e.registered_at, e.started_at)
from public.contests c
where c.id = e.contest_id
  and (e.participation_mode is null or e.registered_at is null);

alter table public.contest_entries
  alter column participation_mode set default 'rated',
  alter column participation_mode set not null,
  alter column registered_at set default now(),
  alter column registered_at set not null;

alter table public.contest_entries
  drop constraint if exists contest_entries_participation_mode_check;
alter table public.contest_entries
  add constraint contest_entries_participation_mode_check
  check (participation_mode in ('rated', 'unrated'));

create index if not exists contest_entries_mode_standing_idx
  on public.contest_entries (contest_id, participation_mode, score desc, penalty_seconds asc);

create or replace function public.register_for_contest(
  p_contest_id uuid,
  p_participation_mode text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  c public.contests%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if public.is_user_banned(v_user) then raise exception 'banned user'; end if;
  if p_participation_mode not in ('rated', 'unrated') then
    raise exception 'invalid participation mode';
  end if;

  select * into c from public.contests where id = p_contest_id for update;
  if not found or c.publication_status <> 'published' then
    raise exception 'contest not found';
  end if;
  if now() >= c.starts_at then raise exception 'registration closed'; end if;
  if p_participation_mode = 'rated' and not c.is_rated then
    raise exception 'rated participation unavailable';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_user and grade_level = c.grade_level
  ) then
    raise exception 'grade mismatch';
  end if;

  insert into public.contest_entries (
    contest_id, user_id, participation_mode, registered_at, started_at
  ) values (
    c.id, v_user, p_participation_mode, now(), c.starts_at
  )
  on conflict (contest_id, user_id) do update
  set participation_mode = excluded.participation_mode,
      registered_at = now(),
      started_at = c.starts_at
  where not exists (
    select 1 from public.contest_answers a
    where a.contest_id = c.id and a.user_id = v_user
  );

  return p_participation_mode;
end;
$$;

revoke all on function public.register_for_contest(uuid,text) from public, anon;
grant execute on function public.register_for_contest(uuid,text) to authenticated;

create or replace function public.unregister_from_contest(p_contest_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_deleted boolean;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.contests c
    where c.id = p_contest_id
      and c.publication_status = 'published'
      and now() < c.starts_at
  ) then
    raise exception 'registration closed';
  end if;
  if exists (
    select 1 from public.contest_answers
    where contest_id = p_contest_id and user_id = v_user
  ) then
    raise exception 'contest already started';
  end if;

  delete from public.contest_entries
  where contest_id = p_contest_id and user_id = v_user;
  v_deleted := found;
  return v_deleted;
end;
$$;

revoke all on function public.unregister_from_contest(uuid) from public, anon;
grant execute on function public.unregister_from_contest(uuid) to authenticated;

create or replace function public.record_contest_answer(
  p_user_id uuid,
  p_contest_id uuid,
  p_question_key text,
  p_user_answer text,
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
  select * into c from public.contests where id = p_contest_id for update;
  if not found or c.publication_status <> 'published'
     or now() < c.starts_at or now() > c.ends_at then
    raise exception 'contest is not active';
  end if;
  if public.is_user_banned(p_user_id) then raise exception 'banned user'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and grade_level = c.grade_level
  ) then
    raise exception 'grade mismatch';
  end if;
  select * into e
  from public.contest_entries
  where contest_id = c.id and user_id = p_user_id
  for update;
  if not found then raise exception 'contest registration required'; end if;
  if not (c.question_keys ? p_question_key)
     or length(p_user_answer) > 500 then
    raise exception 'invalid contest answer';
  end if;
  if exists (
    select 1 from public.contest_answers
    where contest_id = c.id
      and user_id = p_user_id
      and question_key = p_question_key
  ) then
    raise exception 'question already answered';
  end if;

  insert into public.contest_answers (
    contest_id, user_id, question_key, user_answer, is_correct
  ) values (
    c.id, p_user_id, p_question_key, p_user_answer, p_is_correct
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
  from public.contest_answers
  where contest_id = c.id and user_id = p_user_id;
  if v_count >= jsonb_array_length(c.question_keys) then
    update public.contest_entries set finished_at = now() where id = e.id;
  end if;
  return query select e.score, e.solved;
end;
$$;

revoke all on function public.record_contest_answer(uuid,uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.record_contest_answer(uuid,uuid,text,text,boolean)
  to service_role;

-- Rated calculations only include users who explicitly chose Rated.
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

  update public.contest_entries target
  set final_rank = ranked.actual_rank
  from (
    select id,
      rank() over (order by score desc, penalty_seconds asc)::double precision as actual_rank
    from public.contest_entries
    where contest_id = c.id
  ) ranked
  where target.id = ranked.id;

  select count(*) into v_count
  from public.contest_entries e
  where e.contest_id = c.id
    and e.participation_mode = 'rated'
    and exists (
      select 1 from public.contest_answers a
      where a.contest_id = c.id
        and a.user_id = e.user_id
    );
  if not c.is_rated or v_count < 2 then
    update public.contests set ratings_finalized_at = now() where id = c.id;
    return true;
  end if;

  insert into public.battle_ratings (user_id)
  select e.user_id
  from public.contest_entries e
  where e.contest_id = c.id
    and e.participation_mode = 'rated'
    and exists (
      select 1 from public.contest_answers a
      where a.contest_id = c.id
        and a.user_id = e.user_id
    )
  on conflict (user_id) do nothing;

  perform 1 from public.battle_ratings
  where user_id in (
    select e.user_id from public.contest_entries e
    where e.contest_id = c.id
      and e.participation_mode = 'rated'
      and exists (
        select 1 from public.contest_answers a
        where a.contest_id = c.id
          and a.user_id = e.user_id
      )
  )
  order by user_id for update;

  for participant in
    select ranked.user_id, ranked.rating, ranked.rated_events, ranked.actual_rank
    from (
      select e.user_id, r.rating, r.rated_events,
        rank() over (order by e.score desc, e.penalty_seconds asc)::double precision as actual_rank
      from public.contest_entries e
      join public.battle_ratings r on r.user_id = e.user_id
      where e.contest_id = c.id
        and e.participation_mode = 'rated'
        and exists (
          select 1 from public.contest_answers a
          where a.contest_id = c.id and a.user_id = e.user_id
        )
    ) ranked
  loop
    select array_agg(r.rating order by e.user_id)
    into v_opponent_ratings
    from public.contest_entries e
    join public.battle_ratings r on r.user_id = e.user_id
    where e.contest_id = c.id
      and e.participation_mode = 'rated'
      and exists (
        select 1 from public.contest_answers a
        where a.contest_id = c.id and a.user_id = e.user_id
      )
      and e.user_id <> participant.user_id;

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
        sqrt(v_seed * participant.actual_rank),
        v_opponent_ratings
      ) as performance
    ) calculated
    on conflict (contest_id, user_id) do nothing;
  end loop;

  select round(-coalesce(sum(rating_change), 0) / v_count::numeric)::integer - 1
  into v_first_correction
  from public.contest_rating_changes
  where contest_id = c.id;

  update public.contest_rating_changes
  set rating_change = rating_change + v_first_correction,
      correction = correction + v_first_correction
  where contest_id = c.id;

  v_top_count := least(
    v_count,
    greatest(1, round(4 * sqrt(v_count::numeric))::integer)
  );
  select coalesce(sum(top_participant.rating_change), 0)
  into v_top_sum
  from (
    select rating_change
    from public.contest_rating_changes
    where contest_id = c.id
    order by rating_before desc
    limit v_top_count
  ) top_participant;
  v_top_correction := greatest(
    -10,
    least(0, round(-v_top_sum / v_top_count::numeric)::integer)
  );

  update public.contest_rating_changes
  set rating_change = greatest(-250, least(250, rating_change + v_top_correction)),
      correction = correction + v_top_correction
  where contest_id = c.id;

  for participant in
    select * from public.contest_rating_changes
    where contest_id = c.id
    order by user_id
  loop
    v_after := greatest(
      100,
      least(5000, participant.rating_before + participant.rating_change)
    );

    update public.contest_rating_changes
    set rating_after = v_after,
        rating_change = v_after - participant.rating_before
    where id = participant.id;

    update public.battle_ratings
    set rating = v_after,
        peak_rating = greatest(peak_rating, v_after),
        rated_events = rated_events + 1,
        updated_at = now()
    where user_id = participant.user_id;

    update public.battle_rating_history
    set source = 'contest',
        event_type = 'contest',
        event_id = c.id,
        expected_rank = participant.expected_rank,
        actual_rank = participant.actual_rank,
        performance_rating = participant.performance_rating,
        base_delta = participant.base_delta,
        correction = (v_after - participant.rating_before)
          - round(participant.base_delta * participant.provisional_factor)::integer,
        provisional_factor = participant.provisional_factor
    where id = (
      select id from public.battle_rating_history
      where user_id = participant.user_id
        and event_id is null
        and rating_change = v_after - participant.rating_before
        and created_at >= transaction_timestamp()
      order by created_at desc, id desc
      limit 1
    );

    update public.contest_entries
    set rating_before = participant.rating_before,
        rating_after = v_after,
        rating_change = v_after - participant.rating_before
    where contest_id = c.id and user_id = participant.user_id;
  end loop;

  update public.contests set ratings_finalized_at = now() where id = c.id;
  return true;
end;
$$;

revoke all on function public.finalize_contest_ratings(uuid) from public, anon;
grant execute on function public.finalize_contest_ratings(uuid)
  to authenticated, service_role;

-- The return row type changes, so DROP is required before recreation.
drop function if exists public.get_contest_leaderboard(uuid,integer);
create function public.get_contest_leaderboard(
  p_contest_id uuid,
  p_limit integer default 100
)
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
  rating_change integer,
  participation_mode text,
  has_submitted boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select e.user_id, p.nickname, p.avatar_url,
    coalesce(e.rating_after, r.rating, 1200),
    e.score, e.solved, e.penalty_seconds, e.finished_at,
    e.final_rank, e.rating_before, e.rating_after, e.rating_change,
    e.participation_mode,
    exists (
      select 1 from public.contest_answers a
      where a.contest_id = e.contest_id and a.user_id = e.user_id
    )
  from public.contest_entries e
  join public.profiles p on p.id = e.user_id
  left join public.battle_ratings r on r.user_id = e.user_id
  where e.contest_id = p_contest_id
    and auth.uid() is not null
    and not public.is_user_banned(p.id)
  order by e.score desc, e.penalty_seconds asc, e.registered_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

grant execute on function public.get_contest_leaderboard(uuid,integer)
  to authenticated;

notify pgrst, 'reload schema';
