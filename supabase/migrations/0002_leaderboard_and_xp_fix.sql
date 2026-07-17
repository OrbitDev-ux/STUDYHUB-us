-- 0002_leaderboard_and_xp_fix.sql
-- 목적:
--   1) /rank 리더보드 버그 수정: profiles의 select RLS 정책이 "본인 행만"(profiles_select_own)이라
--      다른 유저의 xp/streak를 조회하는 랭킹 쿼리가 항상 빈 배열을 반환하던 문제를 해결.
--      -> 전체 컬럼을 공개하지 않고, security definer 함수로 랭킹에 필요한 컬럼만 제한적으로 노출.
--   2) profiles.level 컬럼이 존재하지만 어디서도 계산/갱신되지 않던 문제 해결.
--      -> calculate_level() 로 XP -> 레벨 공식을 DB에 단일화하고, award_xp()가 매번 재계산.
--   3) XP 갱신이 "읽고 -> 클라이언트에서 더하고 -> 쓰는" 방식이라 동시 요청 시 XP가 유실될 수 있는
--      레이스 컨디션 수정. -> award_xp()에서 `xp = xp + amount`로 원자적으로 갱신.
--   4) timer 액션(saveStudySession)이 xp_transactions에 기록을 남기지 않고 profiles.xp만 직접
--      갱신하던 불일치 수정. -> 모든 XP 지급 경로가 award_xp()를 거치도록 통일.
--   5) 연속학습일(streak) 갱신도 동일한 레이스 컨디션이 있어 bump_streak()로 원자화.

-- ---------------------------------------------------------------------------
-- 1) 레벨 공식: 레벨업에 필요한 누적 XP가 레벨마다 50씩 더 늘어나는 계단식 증가.
--    Lv1: 0xp, Lv2: 100xp, Lv3: 250xp, Lv4: 450xp, Lv5: 700xp, Lv6: 1000xp ...
-- ---------------------------------------------------------------------------
create or replace function public.calculate_level(p_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  lvl integer := 1;
  required integer := 0;
  step integer := 100;
begin
  if p_xp is null or p_xp < 0 then
    return 1;
  end if;

  while p_xp >= required + step loop
    required := required + step;
    lvl := lvl + 1;
    step := step + 50;
  end loop;

  return lvl;
end;
$$;

comment on function public.calculate_level(integer) is
  'XP -> 레벨 변환 공식. lib/gamification/level.ts의 xpForLevel()과 반드시 동일하게 유지할 것.';

-- ---------------------------------------------------------------------------
-- 2) XP 원자적 지급 + 레벨 재계산 + xp_transactions 기록을 한 트랜잭션으로 처리.
--    반드시 auth.uid() 기준 본인에게만 지급 (user_id를 파라미터로 받지 않음 -> 스푸핑 불가).
-- ---------------------------------------------------------------------------
create or replace function public.award_xp(p_amount integer, p_reason text)
returns table(new_xp integer, new_level integer, leveled_up boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old_level integer;
  v_new_xp integer;
  v_new_level integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select level into v_old_level from public.profiles where id = v_user for update;

  if p_amount is null or p_amount = 0 then
    select xp into v_new_xp from public.profiles where id = v_user;
    return query select v_new_xp, v_old_level, false;
    return;
  end if;

  update public.profiles
  set xp = greatest(0, xp + p_amount)
  where id = v_user
  returning xp into v_new_xp;

  v_new_level := public.calculate_level(v_new_xp);

  update public.profiles set level = v_new_level where id = v_user;

  insert into public.xp_transactions (user_id, amount, reason) values (v_user, p_amount, p_reason);

  return query select v_new_xp, v_new_level, (v_new_level > coalesce(v_old_level, 1));
end;
$$;

grant execute on function public.calculate_level(integer) to authenticated;
grant execute on function public.award_xp(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) 연속학습일(streak) 원자적 갱신. 같은 날 중복 호출은 무시.
-- ---------------------------------------------------------------------------
create or replace function public.bump_streak()
returns table(new_streak integer, is_new_day boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_last date;
  v_streak integer;
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := (now() at time zone 'utc')::date - 1;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select last_study_date, streak_days into v_last, v_streak
  from public.profiles where id = v_user for update;

  if v_last = v_today then
    return query select coalesce(v_streak, 0), false;
    return;
  end if;

  if v_last = v_yesterday then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles set last_study_date = v_today, streak_days = v_streak where id = v_user;

  return query select v_streak, true;
end;
$$;

grant execute on function public.bump_streak() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) 리더보드 공개 조회: profiles 전체를 노출하지 않고 랭킹에 필요한 컬럼만 반환.
--    security definer로 RLS(profiles_select_own)를 우회하되, 함수 자체가 컬럼을 제한하므로
--    exam_date/target_score/grade_level 등 민감할 수 있는 정보는 노출되지 않음.
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard(limit_count integer default 20)
returns table(id uuid, nickname text, avatar_url text, xp integer, level integer, streak_days integer)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nickname, p.avatar_url, p.xp, p.level, p.streak_days
  from public.profiles p
  where auth.uid() is not null
  order by p.xp desc, p.streak_days desc
  limit least(greatest(coalesce(limit_count, 20), 1), 100);
$$;

grant execute on function public.get_leaderboard(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) 기존 유저 데이터 백필: xp는 있지만 level이 갱신된 적 없는 행 보정.
-- ---------------------------------------------------------------------------
update public.profiles
set level = public.calculate_level(xp)
where level is distinct from public.calculate_level(xp);
