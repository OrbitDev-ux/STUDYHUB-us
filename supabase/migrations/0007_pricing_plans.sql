-- ---------------------------------------------------------------------------
-- 유료 플랜 (Free / Basic / Pro)
--
-- 아직 실제 결제(PG) 연동은 없다. 관리자가 사용자를 찾아 수동으로 플랜을 바꿔주는
-- 방식으로 우선 운영한다 (수동 결제/계좌이체 확인 후 관리자가 반영하는 식).
-- plan은 profiles의 다른 자기서비스 불가 컬럼(xp/coins/level/role)과 같은 이유로
-- 사용자가 직접 못 바꾸게 하고, set_user_plan() security definer 함수로만 바꾼다
-- (0003의 패턴을 그대로 따름).
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column plan text not null default 'free' check (plan in ('free', 'basic', 'pro'));

create or replace function public.set_user_plan(p_target_user_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin role required';
  end if;

  if p_plan not in ('free', 'basic', 'pro') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  update public.profiles set plan = p_plan, updated_at = now() where id = p_target_user_id;
end;
$$;

grant execute on function public.set_user_plan(uuid, text) to authenticated;
