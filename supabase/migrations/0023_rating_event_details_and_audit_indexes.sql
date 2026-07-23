-- Preserve human-readable Rating event identities even if the originating
-- battle/contest is later removed, and make developer audit searches fast.

alter table public.battle_rating_history
  add column if not exists event_title text,
  add column if not exists opponent_id uuid references public.profiles(id) on delete set null;

create or replace function public.enrich_rating_history_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opponent_id uuid;
  v_opponent_name text;
  v_contest_title text;
begin
  if new.event_type = 'battle' and new.event_id is not null then
    select
      case when m.player1_id = new.user_id then m.player2_id else m.player1_id end,
      p.nickname
    into v_opponent_id, v_opponent_name
    from public.battle_matches m
    join public.profiles p on p.id = case
      when m.player1_id = new.user_id then m.player2_id
      else m.player1_id
    end
    where m.id = new.event_id
      and new.user_id in (m.player1_id, m.player2_id);
    new.opponent_id := v_opponent_id;
    new.event_title := coalesce('Battle vs ' || v_opponent_name, 'Problem Battle');
  elsif new.event_type = 'contest' and new.event_id is not null then
    select c.title into v_contest_title
    from public.contests c
    where c.id = new.event_id;
    new.event_title := coalesce(v_contest_title, 'Rated Contest');
  elsif new.source = 'admin_adjustment' then
    new.event_title := 'Admin Rating Adjustment';
  elsif new.source in ('signup', 'initial') then
    new.event_title := 'Account Created';
  end if;
  return new;
end;
$$;

drop trigger if exists enrich_rating_history_event_trigger
  on public.battle_rating_history;
create trigger enrich_rating_history_event_trigger
before insert or update of event_type, event_id, source
on public.battle_rating_history
for each row execute function public.enrich_rating_history_event();

update public.battle_rating_history h
set
  opponent_id = case
    when m.player1_id = h.user_id then m.player2_id
    else m.player1_id
  end,
  event_title = 'Battle vs ' || p.nickname
from public.battle_matches m
join public.profiles p on p.id in (m.player1_id, m.player2_id)
where h.event_type = 'battle'
  and h.event_id = m.id
  and p.id = case
    when m.player1_id = h.user_id then m.player2_id
    else m.player1_id
  end;

update public.battle_rating_history h
set event_title = c.title
from public.contests c
where h.event_type = 'contest'
  and h.event_id = c.id;

update public.battle_rating_history
set event_title = case
  when source = 'admin_adjustment' then 'Admin Rating Adjustment'
  when source in ('signup', 'initial') then 'Account Created'
  else event_title
end
where event_title is null;

create index if not exists battle_rating_history_opponent_idx
  on public.battle_rating_history (opponent_id, created_at desc);
create index if not exists developer_audit_logs_action_date_idx
  on public.developer_audit_logs (action, created_at desc);
create index if not exists developer_audit_logs_actor_date_idx
  on public.developer_audit_logs (actor_id, created_at desc);
create index if not exists developer_audit_logs_target_idx
  on public.developer_audit_logs (target_type, target_id, created_at desc);

notify pgrst, 'reload schema';
