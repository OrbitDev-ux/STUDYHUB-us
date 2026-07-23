-- Every Rating mutation produces a reasoned in-app notification.

alter table public.battle_rating_history
  add column if not exists reason text;

create or replace function public.notify_rating_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
  v_reason text;
  v_title text;
  v_my_score integer;
  v_opponent_score integer;
  v_contest_title text;
  v_contest_rank double precision;
begin
  if new.rating is not distinct from old.rating then return new; end if;
  v_delta := new.rating - old.rating;
  v_reason := nullif(current_setting('studyhub.rating_reason', true), '');

  if v_reason is null and new.games > old.games then
    select
      case
        when m.player1_id = new.user_id then m.player1_score
        else m.player2_score
      end as my_score,
      case
        when m.player1_id = new.user_id then m.player2_score
        else m.player1_score
      end as opponent_score
    into v_my_score, v_opponent_score
    from public.battle_matches m
    where new.user_id in (m.player1_id, m.player2_id)
      and m.status = 'active'
    order by m.created_at desc
    limit 1;
    if found then
      v_reason := case
        when v_my_score > v_opponent_score
          then format('문제풀이 배틀 승리 (%s:%s)', v_my_score, v_opponent_score)
        when v_my_score < v_opponent_score
          then format('문제풀이 배틀 패배 (%s:%s)', v_my_score, v_opponent_score)
        else format('문제풀이 배틀 무승부 (%s:%s)', v_my_score, v_opponent_score)
      end;
    else
      v_reason := '문제풀이 배틀 결과';
    end if;
  elsif v_reason is null and new.rated_events > old.rated_events then
    select c.title, crc.actual_rank into v_contest_title, v_contest_rank
    from public.contest_rating_changes crc
    join public.contests c on c.id = crc.contest_id
    where crc.user_id = new.user_id
    order by crc.created_at desc
    limit 1;
    v_reason := case
      when v_contest_title is not null
        then format('%s 대회 결과 (#%s)', v_contest_title, v_contest_rank)
      else 'Rated 대회 결과'
    end;
  end if;

  v_reason := coalesce(v_reason, '운영자 Rating 조정');
  v_title := case
    when v_delta > 0 then 'Rating 상승'
    when v_delta < 0 then 'Rating 하락'
    else 'Rating 조정'
  end;

  insert into public.notifications (user_id, type, title, body)
  values (
    new.user_id,
    'rating',
    v_title,
    format(
      '사유: %s · Rating %s → %s (%s%s)',
      v_reason,
      old.rating,
      new.rating,
      case when v_delta > 0 then '+' else '' end,
      v_delta
    )
  );

  update public.battle_rating_history set reason = v_reason
  where id = (
    select id from public.battle_rating_history
    where user_id = new.user_id
      and rating = new.rating
      and rating_change = v_delta
      and created_at >= transaction_timestamp()
    order by created_at desc, id desc
    limit 1
  );

  return new;
end;
$$;

drop trigger if exists rating_change_notification_trigger on public.battle_ratings;
create trigger rating_change_notification_trigger
after update of rating on public.battle_ratings
for each row
when (new.rating is distinct from old.rating)
execute function public.notify_rating_change();

create or replace function public.admin_adjust_rating(
  p_target_user_id uuid,
  p_rating integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required'; end if;
  if p_rating < 100 or p_rating > 5000 then raise exception 'rating out of range'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3
    or char_length(trim(p_reason)) > 200 then
    raise exception 'adjustment reason must be 3 to 200 characters';
  end if;

  insert into public.battle_ratings (user_id)
  values (p_target_user_id)
  on conflict (user_id) do nothing;

  perform set_config('studyhub.rating_reason', trim(p_reason), true);
  update public.battle_ratings set
    rating = p_rating,
    peak_rating = greatest(peak_rating, p_rating),
    updated_at = now()
  where user_id = p_target_user_id;

  update public.battle_rating_history set
    source = 'admin_adjustment',
    reason = trim(p_reason)
  where id = (
    select id from public.battle_rating_history
    where user_id = p_target_user_id
      and rating = p_rating
      and created_at >= transaction_timestamp()
    order by created_at desc, id desc
    limit 1
  );
end;
$$;

revoke all on function public.admin_adjust_rating(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_rating(uuid, integer, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
