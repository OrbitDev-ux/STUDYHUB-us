-- Developer Rating event management.
-- Deleting a Rating event removes its effect, rebuilds every later snapshot,
-- synchronizes the current/peak Rating, and records a reasoned notification.

create index if not exists battle_rating_history_global_date_idx
  on public.battle_rating_history (created_at desc, id desc);
create index if not exists battle_rating_history_source_date_idx
  on public.battle_rating_history (source, created_at desc);

-- Internal rebuilds must not create an additional Rating History point.
create or replace function public.capture_battle_rating_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('studyhub.suppress_rating_side_effects', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.battle_rating_history (user_id, rating, rating_change, source)
    values (new.user_id, new.rating, 0, 'initial');
  elsif new.rating is distinct from old.rating then
    insert into public.battle_rating_history (user_id, rating, rating_change, source)
    values (new.user_id, new.rating, new.rating - old.rating, 'battle');
  end if;
  return new;
end;
$$;

-- The existing notification trigger remains active for ordinary changes, but
-- a rebuild writes one explicit deletion/recalculation notification instead.
drop trigger if exists rating_change_notification_trigger on public.battle_ratings;
create trigger rating_change_notification_trigger
after update of rating on public.battle_ratings
for each row
when (
  new.rating is distinct from old.rating
  and coalesce(current_setting('studyhub.suppress_rating_side_effects', true), '') <> 'on'
)
execute function public.notify_rating_change();

create or replace function public.admin_delete_rating_history(
  p_history_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.battle_rating_history%rowtype;
  v_history record;
  v_current_before integer;
  v_current_after integer := 1200;
  v_previous integer := 1200;
  v_peak integer := 1200;
  v_next integer;
  v_delta integer;
  v_rated_events integer := 0;
  v_reason text := trim(coalesce(p_reason, ''));
  v_nickname text;
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 300 then
    raise exception 'deletion reason must be 5 to 300 characters';
  end if;

  select * into v_event
  from public.battle_rating_history
  where id = p_history_id
  for update;

  if not found then
    raise exception 'rating history event not found';
  end if;
  if coalesce(v_event.event_type, '') = 'signup'
    or v_event.source in ('signup', 'initial', 'backfill') then
    raise exception 'account creation Rating point cannot be deleted';
  end if;

  insert into public.battle_ratings (user_id)
  values (v_event.user_id)
  on conflict (user_id) do nothing;

  select rating into v_current_before
  from public.battle_ratings
  where user_id = v_event.user_id
  for update;

  delete from public.battle_rating_history where id = p_history_id;

  -- Preserve every remaining event's stored delta, but rebuild its absolute
  -- Rating in chronological order. Boundary clamping is reflected in delta.
  v_current_after := 1200;
  v_peak := 1200;
  for v_history in
    select id, rating, rating_change, source, event_type, event_id
    from public.battle_rating_history
    where user_id = v_event.user_id
    order by created_at asc, id asc
  loop
    if v_history.source in ('signup', 'initial', 'backfill')
      or coalesce(v_history.event_type, '') = 'signup' then
      v_current_after := greatest(100, least(5000, v_history.rating));
      update public.battle_rating_history
      set rating = v_current_after, rating_change = 0
      where id = v_history.id;
    else
      v_previous := v_current_after;
      v_delta := v_history.rating_change;
      v_next := greatest(100, least(5000, v_current_after + v_delta));
      update public.battle_rating_history
      set rating = v_next, rating_change = v_next - v_current_after
      where id = v_history.id;
      v_current_after := v_next;

      -- Keep the origin tables aligned with every rebuilt History snapshot.
      if v_history.event_type = 'battle' and v_history.event_id is not null then
        update public.battle_matches
        set
          player1_rating_before = case when player1_id = v_event.user_id then v_previous else player1_rating_before end,
          player2_rating_before = case when player2_id = v_event.user_id then v_previous else player2_rating_before end,
          player1_rating_after = case when player1_id = v_event.user_id then v_current_after else player1_rating_after end,
          player2_rating_after = case when player2_id = v_event.user_id then v_current_after else player2_rating_after end
        where id = v_history.event_id
          and v_event.user_id in (player1_id, player2_id);
      elsif v_history.event_type = 'contest' and v_history.event_id is not null then
        update public.contest_rating_changes
        set
          rating_before = v_previous,
          rating_after = v_current_after,
          rating_change = v_current_after - v_previous
        where contest_id = v_history.event_id and user_id = v_event.user_id;
        update public.contest_entries
        set
          rating_before = v_previous,
          rating_after = v_current_after,
          rating_change = v_current_after - v_previous
        where contest_id = v_history.event_id and user_id = v_event.user_id;
      end if;
    end if;
    v_peak := greatest(v_peak, v_current_after);
  end loop;

  select count(*)::integer into v_rated_events
  from public.battle_rating_history
  where user_id = v_event.user_id
    and (
      event_type in ('battle', 'contest')
      or source in ('battle', 'contest')
    );

  perform set_config('studyhub.suppress_rating_side_effects', 'on', true);
  update public.battle_ratings
  set
    rating = v_current_after,
    peak_rating = v_peak,
    rated_events = v_rated_events,
    updated_at = now()
  where user_id = v_event.user_id;

  -- Remove stale settlement details without deleting the actual match/score.
  if v_event.event_type = 'battle' and v_event.event_id is not null then
    update public.battle_matches
    set
      player1_rating_after = case when player1_id = v_event.user_id then null else player1_rating_after end,
      player2_rating_after = case when player2_id = v_event.user_id then null else player2_rating_after end,
      player1_expected_rank = case when player1_id = v_event.user_id then null else player1_expected_rank end,
      player2_expected_rank = case when player2_id = v_event.user_id then null else player2_expected_rank end,
      player1_actual_rank = case when player1_id = v_event.user_id then null else player1_actual_rank end,
      player2_actual_rank = case when player2_id = v_event.user_id then null else player2_actual_rank end,
      player1_performance_rating = case when player1_id = v_event.user_id then null else player1_performance_rating end,
      player2_performance_rating = case when player2_id = v_event.user_id then null else player2_performance_rating end,
      player1_base_delta = case when player1_id = v_event.user_id then null else player1_base_delta end,
      player2_base_delta = case when player2_id = v_event.user_id then null else player2_base_delta end,
      player1_correction = case when player1_id = v_event.user_id then null else player1_correction end,
      player2_correction = case when player2_id = v_event.user_id then null else player2_correction end,
      player1_provisional_factor = case when player1_id = v_event.user_id then null else player1_provisional_factor end,
      player2_provisional_factor = case when player2_id = v_event.user_id then null else player2_provisional_factor end
    where id = v_event.event_id
      and v_event.user_id in (player1_id, player2_id);
  elsif v_event.event_type = 'contest' and v_event.event_id is not null then
    delete from public.contest_rating_changes
    where contest_id = v_event.event_id and user_id = v_event.user_id;
    update public.contest_entries
    set rating_before = null, rating_after = null, rating_change = null
    where contest_id = v_event.event_id and user_id = v_event.user_id;
  end if;

  select nickname into v_nickname
  from public.profiles
  where id = v_event.user_id;

  insert into public.notifications (user_id, type, title, body)
  values (
    v_event.user_id,
    'rating',
    'Rating 기록 삭제 및 재계산',
    format(
      '사유: %s · 삭제 이벤트: %s · Rating %s → %s',
      v_reason,
      coalesce(v_event.event_title, v_event.source, 'Rating Update'),
      v_current_before,
      v_current_after
    )
  );

  return jsonb_build_object(
    'historyId', v_event.id,
    'userId', v_event.user_id,
    'nickname', v_nickname,
    'deletedEvent', to_jsonb(v_event),
    'ratingBefore', v_current_before,
    'ratingAfter', v_current_after,
    'peakAfter', v_peak,
    'ratedEventsAfter', v_rated_events,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.admin_delete_rating_history(uuid, text)
  from public, anon;
grant execute on function public.admin_delete_rating_history(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
