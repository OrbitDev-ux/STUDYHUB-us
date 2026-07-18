-- ---------------------------------------------------------------------------
-- 배지 자동 지급 + 코인 적립 기능 완성
--
-- 문제: badges/user_badges 테이블과 profiles.coins 컬럼, 관련 UI(랭킹 페이지 배지 목록,
-- top-bar/프로필의 코인 표시)는 이미 있었지만 어떤 코드 경로도 user_badges에 행을 넣거나
-- coins를 올리지 않아서 배지는 항상 잠금 상태, 코인은 항상 0으로 표시되고 있었다.
--
-- 해결:
--   1) award_xp()가 XP와 함께 코인도 지급하도록 확장 (XP 2당 코인 1개, security definer라서
--      profiles 컬럼 권한(0003)과 무관하게 원자적으로 갱신됨).
--   2) 배지 획득 조건을 판정해 자동으로 user_badges에 넣어주는 check_and_award_badges() 추가.
--      - streak_7 / streak_30: profiles.streak_days 기준 (bump_streak 이후 호출)
--      - homework_100: 완료된 homeworks 개수 기준 (completeHomeworkIfDone 이후 호출)
--      - early_bird: 오전 7시(KST) 이전 시작한 study_sessions 5회 기준 (saveStudySession 이후 호출)
--      새로 획득한 배지만 반환해서 앱에서 알림 등에 활용할 수 있게 한다.
-- ---------------------------------------------------------------------------

-- 반환 타입(new_coins 컬럼 추가)이 바뀌므로 create or replace로는 교체할 수 없어 먼저 드롭한다.
drop function if exists public.award_xp(integer, text);

create or replace function public.award_xp(p_amount integer, p_reason text)
returns table(new_xp integer, new_level integer, leveled_up boolean, new_coins integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old_level integer;
  v_new_xp integer;
  v_new_level integer;
  v_new_coins integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select level into v_old_level from public.profiles where id = v_user for update;

  if p_amount is null or p_amount = 0 then
    select xp, coins into v_new_xp, v_new_coins from public.profiles where id = v_user;
    return query select v_new_xp, v_old_level, false, v_new_coins;
    return;
  end if;

  update public.profiles
  set xp = greatest(0, xp + p_amount),
      coins = greatest(0, coins + (p_amount / 2))
  where id = v_user
  returning xp, coins into v_new_xp, v_new_coins;

  v_new_level := public.calculate_level(v_new_xp);

  update public.profiles set level = v_new_level where id = v_user;

  insert into public.xp_transactions (user_id, amount, reason) values (v_user, p_amount, p_reason);

  return query select v_new_xp, v_new_level, (v_new_level > coalesce(v_old_level, 1)), v_new_coins;
end;
$$;

grant execute on function public.award_xp(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 배지 자동 판정 + 지급. 이미 획득한 배지는 건드리지 않고, 이번 호출에서 새로 얻은
-- 배지만 반환한다.
-- ---------------------------------------------------------------------------
create or replace function public.check_and_award_badges()
returns table(code text, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_streak integer;
  v_homework_count integer;
  v_early_bird_count integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select coalesce(streak_days, 0) into v_streak from public.profiles where id = v_user;

  select count(*) into v_homework_count
  from public.homeworks
  where user_id = v_user and status = 'completed';

  select count(*) into v_early_bird_count
  from public.study_sessions
  where user_id = v_user
    and extract(hour from (started_at at time zone 'Asia/Seoul')) < 7;

  return query
  with earned_codes as (
    select unnest(array[
      case when v_streak >= 7 then 'streak_7' end,
      case when v_streak >= 30 then 'streak_30' end,
      case when v_homework_count >= 100 then 'homework_100' end,
      case when v_early_bird_count >= 5 then 'early_bird' end
    ]) as code
  ),
  newly_inserted as (
    insert into public.user_badges (user_id, badge_id)
    select v_user, b.id
    from public.badges b
    join earned_codes ec on ec.code = b.code
    on conflict (user_id, badge_id) do nothing
    returning badge_id
  )
  select b.code, b.name
  from newly_inserted ni
  join public.badges b on b.id = ni.badge_id;
end;
$$;

grant execute on function public.check_and_award_badges() to authenticated;
