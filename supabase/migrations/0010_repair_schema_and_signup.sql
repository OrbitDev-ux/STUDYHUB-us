create table if not exists public.app_settings (
  id boolean primary key default true,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read_all" on public.app_settings;
create policy "app_settings_read_all" on public.app_settings for select using (true);

revoke insert, update, delete on public.app_settings from authenticated, anon;
grant select on public.app_settings to authenticated, anon;

alter table public.settings
  add column if not exists homework_question_count integer;

update public.settings
set homework_question_count = 10
where homework_question_count is null;

alter table public.settings
  alter column homework_question_count set default 10,
  alter column homework_question_count set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.settings'::regclass
      and conname = 'settings_homework_question_count_check'
  ) then
    alter table public.settings
      add constraint settings_homework_question_count_check
      check (homework_question_count between 5 and 30);
  end if;
end $$;

alter table public.profiles
  add column if not exists plan text;

update public.profiles set plan = 'free' where plan is null;

alter table public.profiles
  alter column plan set default 'free',
  alter column plan set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('free', 'basic', 'pro'));
  end if;
end $$;

insert into public.profiles (id, nickname)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nickname'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    '학생'
  )
from auth.users u
on conflict (id) do nothing;

insert into public.settings (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '학생'
    )
  )
  on conflict (id) do nothing;

  insert into public.settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop policy if exists "study_plan_items_insert_own" on public.study_plan_items;
create policy "study_plan_items_insert_own" on public.study_plan_items for insert
  with check (
    exists (
      select 1 from public.study_plans p
      where p.id = plan_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "study_plan_items_delete_own" on public.study_plan_items;
create policy "study_plan_items_delete_own" on public.study_plan_items for delete
  using (
    exists (
      select 1 from public.study_plans p
      where p.id = plan_id and p.user_id = auth.uid()
    )
  );

-- 0004가 누락된 환경의 코인/배지 RPC도 함께 복구한다. 반환 타입이 다를 수 있어
-- 기존 함수를 먼저 제거한다.
drop function if exists public.award_xp(integer, text);

create function public.award_xp(p_amount integer, p_reason text)
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
  insert into public.xp_transactions (user_id, amount, reason)
  values (v_user, p_amount, p_reason);

  return query select v_new_xp, v_new_level, (v_new_level > coalesce(v_old_level, 1)), v_new_coins;
end;
$$;

grant execute on function public.award_xp(integer, text) to authenticated;

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

  select coalesce(streak_days, 0) into v_streak
  from public.profiles where id = v_user;

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

  update public.profiles
  set plan = p_plan, updated_at = now()
  where id = p_target_user_id;

  update public.discord_links
  set premium_role_granted = (p_plan in ('basic', 'pro'))
  where user_id = p_target_user_id;
end;
$$;

grant execute on function public.set_user_plan(uuid, text) to authenticated;

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

notify pgrst, 'reload schema';
