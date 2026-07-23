-- 배틀, 대회, 메시지, 레이팅 변동을 Supabase Realtime으로 전달한다.
do $$
declare t text;
begin
  foreach t in array array[
    'battle_matches', 'battle_ratings', 'battle_rating_history',
    'contest_entries', 'direct_threads', 'direct_messages'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

alter table public.battle_matches replica identity full;
alter table public.battle_ratings replica identity full;
alter table public.battle_rating_history replica identity full;
alter table public.contest_entries replica identity full;
alter table public.direct_threads replica identity full;
alter table public.direct_messages replica identity full;

notify pgrst, 'reload schema';
