-- ---------------------------------------------------------------------------
-- 플랜이 바뀔 때 이미 연동된 Discord 계정의 premium_role_granted도 같이 맞춘다.
-- (Basic/Pro면 true, Free면 false. 실제 Discord 길드 역할 부여는 여전히 별도
--  봇 백엔드의 몫이고, 여기서는 그 봇이 나중에 읽어갈 DB 플래그만 갱신한다.)
-- ---------------------------------------------------------------------------

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

  update public.discord_links
  set premium_role_granted = (p_plan in ('basic', 'pro'))
  where user_id = p_target_user_id;
end;
$$;

grant execute on function public.set_user_plan(uuid, text) to authenticated;
