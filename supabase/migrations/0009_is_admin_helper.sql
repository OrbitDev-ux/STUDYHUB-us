-- ---------------------------------------------------------------------------
-- 관리자 여부 체크가 0005/0007/0008에 걸쳐 동일한 SQL 블록으로 복사되어 있던
-- 것을 public.is_admin() 헬퍼로 뽑아 재사용한다. 시그니처가 바뀌지 않으므로
-- 기존 권한(GRANT EXECUTE)은 유지되지만, 명시적으로 다시 선언해 안전하게 한다.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.set_maintenance_mode(p_enabled boolean, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;

  update public.app_settings
  set maintenance_mode = p_enabled,
      maintenance_message = p_message,
      updated_at = now()
  where id = true;
end;
$$;

grant execute on function public.set_maintenance_mode(boolean, text) to authenticated;

create or replace function public.set_user_plan(p_target_user_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;

  if p_plan not in ('free', 'basic', 'pro') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  update public.profiles set plan = p_plan, updated_at = now() where id = p_target_user_id;

  update public.discord_links
  set premium_role_granted = (p_plan in ('basic', 'pro'))
  where user_id = p_target_user_id;
end;
$$;

grant execute on function public.set_user_plan(uuid, text) to authenticated;
