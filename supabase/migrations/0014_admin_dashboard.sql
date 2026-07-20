-- ---------------------------------------------------------------------------
-- 관리자 대시보드: 회원 관리에서 사용자 role(user/admin)을 변경하기 위한 RPC.
-- set_user_plan()과 동일한 패턴 — 클라이언트가 profiles.role을 직접 UPDATE할 수
-- 없으므로(0003), 반드시 이 security definer 함수를 거쳐야 하고 함수 자체가
-- 호출자의 관리자 권한을 다시 검증한다. 본인의 관리자 권한을 스스로 해제해
-- 관리자가 0명이 되는 사고를 막기 위해 셀프 강등은 별도로 막는다.
-- ---------------------------------------------------------------------------

create or replace function public.set_user_role(p_target_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;

  if p_role not in ('user', 'admin') then
    raise exception 'invalid role: %', p_role;
  end if;

  if p_target_user_id = auth.uid() and p_role = 'user' then
    raise exception 'cannot remove your own admin role';
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_target_user_id;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 관리자 대시보드 개요에 필요한 집계 통계를 한 번의 왕복으로 모아서 반환한다.
-- (총 회원 수, 오늘/이번 주 가입, 플랜 분포, 오늘 활동 유저 수 등)
-- 개별 count 쿼리를 여러 번 왕복하는 대신 하나의 함수에서 처리해 대시보드
-- 로딩을 가볍게 한다. 날짜 경계는 이 프로젝트의 관례대로 KST 기준으로 계산한다.
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_week_start date := v_today - 6;
  v_today_start_utc timestamptz := (v_today::timestamp at time zone 'Asia/Seoul');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users_today', (select count(*) from public.profiles where (created_at at time zone 'Asia/Seoul')::date = v_today),
    'new_users_week', (select count(*) from public.profiles where (created_at at time zone 'Asia/Seoul')::date >= v_week_start),
    'admin_count', (select count(*) from public.profiles where role = 'admin'),
    'plan_free', (select count(*) from public.profiles where plan = 'free'),
    'plan_basic', (select count(*) from public.profiles where plan = 'basic'),
    'plan_pro', (select count(*) from public.profiles where plan = 'pro'),
    'dau', (select count(distinct user_id) from public.study_sessions where started_at >= v_today_start_utc),
    'study_minutes_today', (select coalesce(sum(focus_minutes), 0) from public.study_sessions where started_at >= v_today_start_utc),
    'homeworks_today', (select count(*) from public.homeworks where date = v_today),
    'homeworks_completed_today', (select count(*) from public.homeworks where date = v_today and status = 'completed'),
    'discord_linked', (select count(*) from public.discord_links),
    'maintenance_mode', (select coalesce(maintenance_mode, false) from public.app_settings where id = true)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_admin_stats() to authenticated;
