-- 플래너 완료 보상을 한 번만 지급하고, 완료 시각을 기록한다.
alter table public.study_plan_items
  add column if not exists completed_at timestamptz,
  add column if not exists xp_awarded boolean not null default false;

-- 한 사용자에게 열린 타이머 세션은 하나만 허용한다.
update public.study_sessions
set ended_at = now(), interrupted = true
where ended_at is null;

create unique index if not exists study_sessions_one_open_per_user
on public.study_sessions (user_id)
where ended_at is null;

create or replace function public.toggle_plan_item(p_item_id uuid, p_completed boolean)
returns table(completed boolean, reward_granted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item public.study_plan_items%rowtype;
  v_reward boolean := false;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select i.* into v_item
  from public.study_plan_items i
  join public.study_plans p on p.id = i.plan_id
  where i.id = p_item_id and p.user_id = v_user
  for update of i;

  if not found then raise exception 'plan item not found'; end if;

  v_reward := p_completed and not v_item.xp_awarded;
  update public.study_plan_items
  set completed = p_completed,
      completed_at = case when p_completed then coalesce(completed_at, now()) else null end,
      xp_awarded = xp_awarded or v_reward
  where id = p_item_id;

  if v_reward then
    perform * from public.award_xp(3, '플래너 항목 완료');
  end if;

  return query select p_completed, v_reward;
end;
$$;

grant execute on function public.toggle_plan_item(uuid, boolean) to authenticated;

-- 세션 종료, streak 갱신, XP 지급을 한 트랜잭션으로 묶는다. 서버 시각 기준 실제
-- 경과 시간을 넘는 값은 잘라내며 동일 세션은 한 번만 완료할 수 있다.
create or replace function public.complete_study_session(
  p_session_id uuid,
  p_focus_minutes integer,
  p_break_minutes integer,
  p_interrupted boolean
)
returns table(credited_focus integer, credited_break integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_session public.study_sessions%rowtype;
  v_elapsed_seconds integer;
  v_elapsed_minutes integer;
  v_focus integer;
  v_break integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select * into v_session from public.study_sessions
  where id = p_session_id and user_id = v_user and ended_at is null
  for update;
  if not found then raise exception 'session not found or already completed'; end if;

  v_elapsed_seconds := greatest(0, floor(extract(epoch from (now() - v_session.started_at)))::integer);
  if v_elapsed_seconds < 30 then raise exception 'minimum session duration is 30 seconds'; end if;
  v_elapsed_minutes := greatest(1, ceil(v_elapsed_seconds / 60.0)::integer);
  v_focus := least(greatest(coalesce(p_focus_minutes, 0), 0), 240, v_elapsed_minutes);
  v_break := least(greatest(coalesce(p_break_minutes, 0), 0), 240, greatest(0, v_elapsed_minutes - v_focus));
  if v_focus < 1 then raise exception 'focus duration must be at least one minute'; end if;

  update public.study_sessions set
    ended_at = now(), focus_minutes = v_focus, break_minutes = v_break,
    interrupted = coalesce(p_interrupted, false)
  where id = p_session_id;

  perform * from public.bump_streak();
  if round(v_focus / 5.0) * 2 > 0 then
    perform * from public.award_xp((round(v_focus / 5.0) * 2)::integer, '타이머 학습 완료');
  end if;

  return query select v_focus, v_break;
end;
$$;

grant execute on function public.complete_study_session(uuid, integer, integer, boolean) to authenticated;

-- 열린 세션이나 0분 세션은 얼리버드 배지 횟수에 포함하지 않는다.
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
  if v_user is null then raise exception 'authentication required'; end if;

  select coalesce(streak_days, 0) into v_streak from public.profiles where id = v_user;
  select count(*) into v_homework_count from public.homeworks
    where user_id = v_user and status = 'completed';
  select count(*) into v_early_bird_count from public.study_sessions
    where user_id = v_user
      and ended_at is not null
      and focus_minutes > 0
      and extract(hour from (started_at at time zone 'Asia/Seoul')) < 7;

  return query
  with earned_codes as (
    select unnest(array[
      case when v_streak >= 7 then 'streak_7' end,
      case when v_streak >= 30 then 'streak_30' end,
      case when v_homework_count >= 100 then 'homework_100' end,
      case when v_early_bird_count >= 5 then 'early_bird' end
    ]) as code
  ), newly_inserted as (
    insert into public.user_badges (user_id, badge_id)
    select v_user, b.id from public.badges b
    join earned_codes ec on ec.code = b.code
    where ec.code is not null
    on conflict (user_id, badge_id) do nothing
    returning badge_id
  )
  select b.code, b.name from newly_inserted ni
  join public.badges b on b.id = ni.badge_id;
end;
$$;

grant execute on function public.check_and_award_badges() to authenticated;
notify pgrst, 'reload schema';
