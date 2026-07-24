-- StudyHub web <-> Discord bot presence and realtime interaction bridge.

create table if not exists public.discord_bot_status (
  id boolean primary key default true,
  connected boolean not null default false,
  bot_user_id text,
  bot_username text,
  guild_count integer not null default 0 check (guild_count >= 0),
  command_count integer not null default 0 check (command_count >= 0),
  started_at timestamptz,
  last_seen_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint discord_bot_status_singleton check (id)
);

insert into public.discord_bot_status (id) values (true)
on conflict (id) do nothing;

alter table public.discord_bot_status enable row level security;
drop policy if exists "discord_bot_status_read_authenticated" on public.discord_bot_status;
create policy "discord_bot_status_read_authenticated"
  on public.discord_bot_status for select
  using (auth.uid() is not null);

revoke insert, update, delete on public.discord_bot_status from anon, authenticated;
grant select on public.discord_bot_status to authenticated;
grant all on public.discord_bot_status to service_role;

-- These streams let the separately deployed bot react immediately while the
-- periodic synchronizer remains a fallback when Realtime reconnects.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'notifications',
    'discord_links',
    'profiles',
    'app_settings',
    'discord_bot_status'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
exception when undefined_object then null;
end $$;

alter table public.notifications replica identity full;
alter table public.discord_links replica identity full;
alter table public.profiles replica identity full;
alter table public.app_settings replica identity full;
alter table public.discord_bot_status replica identity full;

notify pgrst, 'reload schema';
