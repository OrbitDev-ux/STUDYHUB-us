-- ---------------------------------------------------------------------------
-- bump_streak()가 "오늘"을 UTC 기준으로 계산해서 자정~오전 9시(KST) 사이에
-- 공부한 기록이 연속학습일에 잘못 반영되던 문제를 고친다. 이 프로젝트는
-- lib/utils/date.ts의 todayKST()로 KST 기준 날짜를 쓰는 게 규칙이므로,
-- 이 함수도 UTC 대신 Asia/Seoul 기준으로 통일한다.
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
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_yesterday date := (now() at time zone 'Asia/Seoul')::date - 1;
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

  update public.profiles set streak_days = v_streak, last_study_date = v_today where id = v_user;

  return query select v_streak, true;
end;
$$;
