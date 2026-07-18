-- ---------------------------------------------------------------------------
-- 서버 점검 모드
--
-- app_settings: 앱 전역 설정을 담는 싱글톤 테이블(행 1개 고정, id=true).
-- maintenance_mode가 켜지면 관리자(profiles.role='admin')를 제외한 모든 요청이
-- /maintenance 페이지로 리다이렉트된다 (middleware.ts에서 처리).
--
-- 컬럼 단위 권한 잠금(0003)과 동일한 이유로, 이 테이블도 직접 UPDATE 권한을
-- authenticated에게 주지 않고 반드시 set_maintenance_mode() security definer
-- 함수를 통해서만 바꾸도록 한다 (관리자가 아니면 함수 자체가 거부).
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id boolean primary key default true,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

-- 점검 여부는 로그인 전 사용자도 확인해야 하므로 조회는 전체 공개.
create policy "app_settings_read_all" on public.app_settings for select using (true);

-- 직접 UPDATE는 막고, set_maintenance_mode()를 통해서만 바꾸게 한다.
revoke insert, update, delete on public.app_settings from authenticated, anon;
grant select on public.app_settings to authenticated, anon;

create or replace function public.set_maintenance_mode(p_enabled boolean, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
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
