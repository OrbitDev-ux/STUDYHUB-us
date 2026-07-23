-- =========================================================
-- 1:1 문제풀이 배틀 + ELO 레이팅
-- =========================================================

create table if not exists public.battle_ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating integer not null default 1200 check (rating between 100 and 5000),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  peak_rating integer not null default 1200,
  updated_at timestamptz not null default now()
);

create table if not exists public.battle_matches (
  id uuid primary key default gen_random_uuid(),
  grade_level text not null check (grade_level in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')),
  subject_id text not null references public.subjects(id),
  status text not null default 'waiting' check (status in ('waiting','active','completed','cancelled')),
  player1_id uuid not null references auth.users(id) on delete cascade,
  player2_id uuid references auth.users(id) on delete cascade,
  question_keys jsonb not null default '[]'::jsonb,
  player1_score integer not null default 0,
  player2_score integer not null default 0,
  player1_answered integer not null default 0,
  player2_answered integer not null default 0,
  player1_rating_before integer,
  player2_rating_before integer,
  player1_rating_after integer,
  player2_rating_after integer,
  winner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  expires_at timestamptz,
  finished_at timestamptz,
  constraint battle_players_different check (player2_id is null or player1_id <> player2_id)
);

create table if not exists public.battle_answers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,
  user_answer text not null,
  is_correct boolean not null,
  response_ms integer not null default 0 check (response_ms between 0 and 600000),
  answered_at timestamptz not null default now(),
  unique (match_id, user_id, question_key)
);

create index if not exists battle_matches_waiting_idx
  on public.battle_matches (grade_level, subject_id, created_at)
  where status = 'waiting';
create index if not exists battle_matches_player1_idx on public.battle_matches (player1_id, created_at desc);
create index if not exists battle_matches_player2_idx on public.battle_matches (player2_id, created_at desc);
create index if not exists battle_ratings_rank_idx on public.battle_ratings (rating desc, games desc);

alter table public.battle_ratings enable row level security;
alter table public.battle_matches enable row level security;
alter table public.battle_answers enable row level security;

drop policy if exists "battle_ratings_select_own" on public.battle_ratings;
create policy "battle_ratings_select_own" on public.battle_ratings for select using (auth.uid() = user_id);
drop policy if exists "battle_matches_select_participant" on public.battle_matches;
create policy "battle_matches_select_participant" on public.battle_matches for select
  using (auth.uid() = player1_id or auth.uid() = player2_id);
drop policy if exists "battle_answers_select_own" on public.battle_answers;
create policy "battle_answers_select_own" on public.battle_answers for select using (auth.uid() = user_id);

-- 매칭 큐 진입. 같은 학년·과목의 가장 오래 기다린 상대를 원자적으로 잡는다.
create or replace function public.join_battle_queue(p_grade_level text, p_subject_id text, p_question_keys jsonb)
returns table(match_id uuid, match_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match public.battle_matches%rowtype;
  v_rating integer;
  v_opponent_rating integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_grade_level not in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')
     or p_subject_id not in ('math','english','social','science')
     or jsonb_typeof(p_question_keys) <> 'array' or jsonb_array_length(p_question_keys) <> 5
     or (select count(distinct key) from jsonb_array_elements_text(p_question_keys) as q(key)) <> 5
     or exists (
       select 1 from jsonb_array_elements_text(p_question_keys) as q(key)
       where key !~ ('^' || p_grade_level || ':' || p_subject_id || ':([0-9]|1[0-5])$')
     ) then
    raise exception 'invalid battle configuration';
  end if;
  if not exists (select 1 from public.profiles where id = v_user and grade_level = p_grade_level) then
    raise exception 'battle grade must match profile grade';
  end if;

  insert into public.battle_ratings (user_id) values (v_user) on conflict (user_id) do nothing;
  select rating into v_rating from public.battle_ratings where user_id = v_user;

  update public.battle_matches set status = 'cancelled', finished_at = now()
  where status = 'waiting' and created_at < now() - interval '3 minutes';

  -- 이미 대기/진행 중인 방이 있으면 중복 생성하지 않는다.
  select * into v_match from public.battle_matches
  where status in ('waiting','active') and (player1_id = v_user or player2_id = v_user)
  order by created_at desc limit 1;
  if found then return query select v_match.id, v_match.status; return; end if;

  select * into v_match from public.battle_matches
  where status = 'waiting' and grade_level = p_grade_level and subject_id = p_subject_id
    and player1_id <> v_user
  order by created_at asc
  for update skip locked limit 1;

  if found then
    insert into public.battle_ratings (user_id) values (v_match.player1_id) on conflict (user_id) do nothing;
    select rating into v_opponent_rating from public.battle_ratings where user_id = v_match.player1_id;
    update public.battle_matches set
      player2_id = v_user, status = 'active', started_at = now(), expires_at = now() + interval '3 minutes',
      player1_rating_before = v_opponent_rating, player2_rating_before = v_rating
    where id = v_match.id returning * into v_match;
    return query select v_match.id, v_match.status;
  else
    insert into public.battle_matches (
      grade_level, subject_id, player1_id, question_keys, player1_rating_before, expires_at
    ) values (p_grade_level, p_subject_id, v_user, p_question_keys, v_rating, now() + interval '3 minutes')
    returning * into v_match;
    return query select v_match.id, v_match.status;
  end if;
end;
$$;

grant execute on function public.join_battle_queue(text, text, jsonb) to authenticated;

-- 잠긴 매치를 한 번만 ELO 정산하는 내부 함수. K-factor는 32.
create or replace function public.finalize_battle_locked(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.battle_matches%rowtype;
  r1 integer; r2 integer; n1 integer; n2 integer;
  expected1 double precision; result1 double precision;
begin
  select * into m from public.battle_matches where id = p_match_id for update;
  if not found or m.status <> 'active' then return false; end if;
  if (m.player1_answered < 5 or m.player2_answered < 5) and coalesce(m.expires_at, now() + interval '1 minute') > now() then
    return false;
  end if;

  insert into public.battle_ratings (user_id) values (m.player1_id) on conflict (user_id) do nothing;
  insert into public.battle_ratings (user_id) values (m.player2_id) on conflict (user_id) do nothing;
  select rating into r1 from public.battle_ratings where user_id = m.player1_id for update;
  select rating into r2 from public.battle_ratings where user_id = m.player2_id for update;

  expected1 := 1.0 / (1.0 + power(10.0, (r2 - r1) / 400.0));
  result1 := case when m.player1_score > m.player2_score then 1.0 when m.player1_score < m.player2_score then 0.0 else 0.5 end;
  n1 := greatest(100, round(r1 + 32 * (result1 - expected1))::integer);
  n2 := greatest(100, round(r2 + 32 * ((1.0 - result1) - (1.0 - expected1)))::integer);

  update public.battle_ratings set
    rating = n1, peak_rating = greatest(peak_rating, n1), games = games + 1,
    wins = wins + case when result1 = 1 then 1 else 0 end,
    losses = losses + case when result1 = 0 then 1 else 0 end,
    draws = draws + case when result1 = 0.5 then 1 else 0 end, updated_at = now()
  where user_id = m.player1_id;
  update public.battle_ratings set
    rating = n2, peak_rating = greatest(peak_rating, n2), games = games + 1,
    wins = wins + case when result1 = 0 then 1 else 0 end,
    losses = losses + case when result1 = 1 then 1 else 0 end,
    draws = draws + case when result1 = 0.5 then 1 else 0 end, updated_at = now()
  where user_id = m.player2_id;

  update public.battle_matches set status = 'completed', finished_at = now(),
    winner_id = case when result1 = 1 then m.player1_id when result1 = 0 then m.player2_id else null end,
    player1_rating_after = n1, player2_rating_after = n2
  where id = m.id;
  return true;
end;
$$;
revoke all on function public.finalize_battle_locked(uuid) from public, anon, authenticated;

-- 정답 여부는 Server Action이 재검증하고 service_role로만 전달한다.
create or replace function public.record_battle_answer(
  p_user_id uuid, p_match_id uuid, p_question_key text,
  p_user_answer text, p_is_correct boolean, p_response_ms integer
)
returns table(answer_correct boolean, current_score integer, battle_completed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.battle_matches%rowtype;
  v_score integer;
  v_finished boolean;
begin
  select * into m from public.battle_matches where id = p_match_id for update;
  if not found or m.status <> 'active' or p_user_id not in (m.player1_id, m.player2_id) then
    raise exception 'active battle not found';
  end if;
  if m.expires_at <= now() then
    perform public.finalize_battle_locked(m.id);
    raise exception 'battle expired';
  end if;
  if not (m.question_keys ? p_question_key) or length(p_user_answer) > 500 then
    raise exception 'invalid battle answer';
  end if;
  if exists (select 1 from public.battle_answers where match_id = m.id and user_id = p_user_id and question_key = p_question_key) then
    raise exception 'question already answered';
  end if;

  insert into public.battle_answers (match_id, user_id, question_key, user_answer, is_correct, response_ms)
  values (m.id, p_user_id, p_question_key, p_user_answer, p_is_correct, least(greatest(coalesce(p_response_ms, 0), 0), 600000));

  if p_user_id = m.player1_id then
    update public.battle_matches set player1_answered = player1_answered + 1,
      player1_score = player1_score + case when p_is_correct then 1 else 0 end where id = m.id
    returning player1_score into v_score;
  else
    update public.battle_matches set player2_answered = player2_answered + 1,
      player2_score = player2_score + case when p_is_correct then 1 else 0 end where id = m.id
    returning player2_score into v_score;
  end if;
  v_finished := public.finalize_battle_locked(m.id);
  return query select p_is_correct, v_score, v_finished;
end;
$$;
revoke all on function public.record_battle_answer(uuid, uuid, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.record_battle_answer(uuid, uuid, text, text, boolean, integer) to service_role;

-- 참가자가 상태 조회 시 타임아웃 정산을 촉발할 수 있다.
create or replace function public.finalize_battle(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.battle_matches where id = p_match_id and auth.uid() in (player1_id, player2_id)
  ) then raise exception 'battle not found'; end if;
  return public.finalize_battle_locked(p_match_id);
end;
$$;
grant execute on function public.finalize_battle(uuid) to authenticated;

create or replace function public.cancel_waiting_battle(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.battle_matches set status = 'cancelled', finished_at = now()
  where id = p_match_id and status = 'waiting' and player1_id = auth.uid();
end;
$$;
grant execute on function public.cancel_waiting_battle(uuid) to authenticated;

create or replace function public.get_battle_leaderboard(limit_count integer default 20)
returns table(id uuid, nickname text, avatar_url text, rating integer, games integer, wins integer, losses integer, draws integer)
language sql security definer set search_path = public stable as $$
  select p.id, p.nickname, p.avatar_url, r.rating, r.games, r.wins, r.losses, r.draws
  from public.battle_ratings r join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
  order by r.rating desc, r.games desc limit least(greatest(coalesce(limit_count, 20), 1), 100);
$$;
grant execute on function public.get_battle_leaderboard(integer) to authenticated;

notify pgrst, 'reload schema';
