-- Super Admin moderation: account bans, ranking exclusion, user deletion support,
-- and hard Audit Log deletion with an independent deletion receipt.

alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text,
  add column if not exists banned_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_active_ban_idx
  on public.profiles (is_banned, banned_until);

create or replace function public.is_user_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_banned and (p.banned_until is null or p.banned_until > now())
    from public.profiles p
    where p.id = p_user_id
  ), false);
$$;

revoke all on function public.is_user_banned(uuid) from public, anon;
grant execute on function public.is_user_banned(uuid) to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
      and not public.is_user_banned(id)
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and not public.is_user_banned(id)
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.super_admin_set_user_role(
  p_target_user_id uuid,
  p_role text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before text;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.is_super_admin() then raise exception 'super admin role required'; end if;
  perform pg_advisory_xact_lock(731942861::bigint);
  if p_role not in ('user', 'admin', 'super_admin') then raise exception 'invalid role'; end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 300 then
    raise exception 'role change reason must be 5 to 300 characters';
  end if;

  select role into v_before
  from public.profiles
  where id = p_target_user_id
  for update;
  if not found then raise exception 'target user not found'; end if;
  if p_target_user_id = auth.uid() and p_role <> 'super_admin' then
    raise exception 'cannot demote current super admin session';
  end if;
  if p_role = 'super_admin' and public.is_user_banned(p_target_user_id) then
    raise exception 'cannot promote a banned user to super admin';
  end if;
  if v_before = 'super_admin' and p_role <> 'super_admin'
    and (
      select count(*) from public.profiles
      where role = 'super_admin'
        and id <> p_target_user_id
        and not public.is_user_banned(id)
    ) < 1 then
    raise exception 'at least one active super admin is required';
  end if;

  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_target_user_id;

  if v_before is distinct from p_role then
    insert into public.notifications (user_id, type, title, body)
    values (
      p_target_user_id,
      'moderation',
      '계정 운영 권한이 변경되었습니다',
      format('사유: %s · 역할 %s → %s', v_reason, v_before, p_role)
    );
  end if;

  return jsonb_build_object(
    'userId', p_target_user_id,
    'roleBefore', v_before,
    'roleAfter', p_role,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.super_admin_set_user_role(uuid, text, text)
  from public, anon;
grant execute on function public.super_admin_set_user_role(uuid, text, text)
  to authenticated;

create or replace function public.super_admin_set_user_ban(
  p_target_user_id uuid,
  p_banned boolean,
  p_reason text,
  p_banned_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_was_banned boolean;
begin
  if not public.is_super_admin() then raise exception 'super admin role required'; end if;
  perform pg_advisory_xact_lock(731942861::bigint);
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'ban reason must be 5 to 500 characters';
  end if;
  if p_banned and p_banned_until is not null and p_banned_until <= now() then
    raise exception 'ban expiry must be in the future';
  end if;

  select * into v_target
  from public.profiles
  where id = p_target_user_id
  for update;
  if not found then raise exception 'target user not found'; end if;
  if p_target_user_id = auth.uid() then raise exception 'cannot ban current super admin session'; end if;
  if p_banned and v_target.role = 'super_admin'
    and (
      select count(*) from public.profiles
      where role = 'super_admin'
        and id <> p_target_user_id
        and not public.is_user_banned(id)
    ) < 1 then
    raise exception 'at least one active super admin is required';
  end if;

  v_was_banned := v_target.is_banned
    and (v_target.banned_until is null or v_target.banned_until > now());

  if p_banned and not v_was_banned then
    update public.battle_matches
    set status = 'cancelled', finished_at = now()
    where status in ('waiting', 'active')
      and p_target_user_id in (player1_id, player2_id);
    update public.battle_challenges
    set status = 'cancelled', updated_at = now()
    where status = 'pending'
      and p_target_user_id in (challenger_id, target_id);
  end if;

  update public.profiles
  set
    is_banned = p_banned,
    banned_at = case when p_banned then now() else null end,
    banned_until = case when p_banned then p_banned_until else null end,
    ban_reason = case when p_banned then v_reason else null end,
    banned_by = case when p_banned then auth.uid() else null end,
    updated_at = now()
  where id = p_target_user_id;

  insert into public.notifications (user_id, type, title, body)
  values (
    p_target_user_id,
    'moderation',
    case when p_banned then '계정이 이용 정지되었습니다' else '계정 이용 정지가 해제되었습니다' end,
    case
      when p_banned and p_banned_until is null
        then format('사유: %s · 기간: 영구', v_reason)
      when p_banned
        then format('사유: %s · 해제 예정: %s', v_reason, p_banned_until)
      else format('해제 사유: %s', v_reason)
    end
  );

  return jsonb_build_object(
    'userId', p_target_user_id,
    'nickname', v_target.nickname,
    'role', v_target.role,
    'wasBanned', v_was_banned,
    'isBanned', p_banned,
    'bannedUntil', p_banned_until,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.super_admin_set_user_ban(uuid, boolean, text, timestamptz)
  from public, anon;
grant execute on function public.super_admin_set_user_ban(uuid, boolean, text, timestamptz)
  to authenticated;

create table if not exists public.developer_deleted_audit_logs (
  id uuid primary key default gen_random_uuid(),
  original_audit_log_id uuid not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deletion_reason text not null,
  original_snapshot jsonb not null,
  revision_snapshots jsonb not null default '[]'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists developer_deleted_audit_logs_date_idx
  on public.developer_deleted_audit_logs (deleted_at desc);
create index if not exists developer_deleted_audit_logs_original_idx
  on public.developer_deleted_audit_logs (original_audit_log_id);
alter table public.developer_deleted_audit_logs enable row level security;

alter table public.developer_audit_log_revisions
  drop constraint if exists developer_audit_log_revisions_operation_check;
alter table public.developer_audit_log_revisions
  add constraint developer_audit_log_revisions_operation_check
  check (operation in ('update', 'archive', 'restore', 'delete'));

create or replace function public.super_admin_delete_audit_log(
  p_audit_log_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.developer_audit_logs%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_tombstone_id uuid;
  v_revisions jsonb;
begin
  if not public.is_super_admin() then raise exception 'super admin role required'; end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'deletion reason must be 5 to 500 characters';
  end if;

  select * into v_before
  from public.developer_audit_logs
  where id = p_audit_log_id
  for update;
  if not found then raise exception 'audit log not found'; end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
  into v_revisions
  from public.developer_audit_log_revisions r
  where r.audit_log_id = p_audit_log_id;

  insert into public.developer_audit_log_revisions (
    audit_log_id, actor_id, operation, reason, before_snapshot, after_snapshot
  ) values (
    p_audit_log_id, auth.uid(), 'delete', v_reason, to_jsonb(v_before), null
  );

  insert into public.developer_deleted_audit_logs (
    original_audit_log_id, deleted_by, deletion_reason,
    original_snapshot, revision_snapshots
  ) values (
    p_audit_log_id,
    auth.uid(),
    v_reason,
    to_jsonb(v_before),
    v_revisions || jsonb_build_array(jsonb_build_object(
      'operation', 'delete',
      'actor_id', auth.uid(),
      'reason', v_reason,
      'before_snapshot', to_jsonb(v_before),
      'created_at', now()
    ))
  )
  returning id into v_tombstone_id;

  delete from public.developer_audit_logs where id = p_audit_log_id;

  insert into public.developer_audit_logs (
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(),
    'audit.delete',
    'audit_log',
    p_audit_log_id::text,
    jsonb_build_object(
      'reason', v_reason,
      'deletedAction', v_before.action,
      'deletionReceiptId', v_tombstone_id,
      'originalPreserved', true
    )
  );

  return v_tombstone_id;
end;
$$;

revoke all on function public.super_admin_delete_audit_log(uuid, text)
  from public, anon;
grant execute on function public.super_admin_delete_audit_log(uuid, text)
  to authenticated;

-- Banned accounts are excluded from every public ranking.
create or replace function public.get_rating_leaderboard(
  p_page integer default 1,
  p_page_size integer default 50,
  p_query text default '',
  p_grade_level text default null
)
returns table(
  global_rank bigint,
  total_count bigint,
  id uuid,
  nickname text,
  avatar_url text,
  grade_level text,
  rating integer,
  peak_rating integer,
  games integer,
  wins integer,
  losses integer,
  draws integer,
  rated_events integer
)
language sql
security definer
set search_path = public
stable
as $$
  with ranked as (
    select
      rank() over (order by coalesce(r.rating, 1200) desc)::bigint as global_rank,
      p.id, p.nickname, p.avatar_url, p.grade_level,
      coalesce(r.rating, 1200)::integer as rating,
      coalesce(r.peak_rating, 1200)::integer as peak_rating,
      coalesce(r.games, 0)::integer as games,
      coalesce(r.wins, 0)::integer as wins,
      coalesce(r.losses, 0)::integer as losses,
      coalesce(r.draws, 0)::integer as draws,
      coalesce(r.rated_events, 0)::integer as rated_events
    from public.profiles p
    left join public.battle_ratings r on r.user_id = p.id
    where not public.is_user_banned(p.id)
  ),
  filtered as (
    select ranked.*, count(*) over ()::bigint as total_count
    from ranked
    where (
      nullif(trim(left(coalesce(p_query, ''), 50)), '') is null
      or ranked.nickname ilike '%' || trim(left(p_query, 50)) || '%'
    )
    and (
      p_grade_level is null or p_grade_level = ''
      or ranked.grade_level = p_grade_level
    )
  )
  select filtered.global_rank, filtered.total_count, filtered.id,
    filtered.nickname, filtered.avatar_url, filtered.grade_level,
    filtered.rating, filtered.peak_rating, filtered.games, filtered.wins,
    filtered.losses, filtered.draws, filtered.rated_events
  from filtered
  where auth.uid() is not null
  order by filtered.global_rank, filtered.games desc, filtered.nickname
  limit least(greatest(coalesce(p_page_size, 50), 1), 100)
  offset (
    least(greatest(coalesce(p_page, 1), 1), 10000) - 1
  ) * least(greatest(coalesce(p_page_size, 50), 1), 100);
$$;

create or replace function public.get_leaderboard(limit_count integer default 20)
returns table(
  id uuid, nickname text, avatar_url text, xp integer,
  level integer, streak_days integer, rating integer
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nickname, p.avatar_url, p.xp, p.level, p.streak_days,
    coalesce(r.rating, 1200)::integer
  from public.profiles p
  left join public.battle_ratings r on r.user_id = p.id
  where auth.uid() is not null and not public.is_user_banned(p.id)
  order by p.xp desc, p.streak_days desc
  limit least(greatest(coalesce(limit_count, 20), 1), 100);
$$;

create or replace function public.get_battle_leaderboard(limit_count integer default 20)
returns table(
  id uuid, nickname text, avatar_url text, rating integer,
  games integer, wins integer, losses integer, draws integer
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nickname, p.avatar_url, r.rating, r.games, r.wins, r.losses, r.draws
  from public.battle_ratings r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null and not public.is_user_banned(p.id)
  order by r.rating desc, r.games desc
  limit least(greatest(coalesce(limit_count, 20), 1), 100);
$$;

drop function if exists public.get_contest_leaderboard(uuid, integer);
create function public.get_contest_leaderboard(p_contest_id uuid, p_limit integer default 100)
returns table(
  user_id uuid,
  nickname text,
  avatar_url text,
  rating integer,
  score integer,
  solved integer,
  penalty_seconds integer,
  finished_at timestamptz,
  final_rank double precision,
  rating_before integer,
  rating_after integer,
  rating_change integer
)
language sql
security definer
set search_path = public
as $$
  select e.user_id, p.nickname, p.avatar_url,
    coalesce(e.rating_after, r.rating, 1200),
    e.score, e.solved, e.penalty_seconds, e.finished_at,
    e.final_rank, e.rating_before, e.rating_after, e.rating_change
  from public.contest_entries e
  join public.profiles p on p.id = e.user_id
  left join public.battle_ratings r on r.user_id = e.user_id
  where e.contest_id = p_contest_id
    and auth.uid() is not null
    and not public.is_user_banned(p.id)
  order by e.score desc, e.penalty_seconds asc, e.started_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_user_id uuid)
returns table(
  id uuid,
  nickname text,
  avatar_url text,
  banner_url text,
  bio text,
  grade_level text,
  xp integer,
  level integer,
  streak_days integer,
  joined_at timestamptz,
  rating integer,
  peak_rating integer,
  games integer,
  wins integer,
  losses integer,
  draws integer,
  rated_events integer,
  global_rank bigint,
  badge_count bigint,
  is_banned boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with rating_ranks as (
    select p.id,
      rank() over (order by coalesce(r.rating, 1200) desc)::bigint as global_rank
    from public.profiles p
    left join public.battle_ratings r on r.user_id = p.id
    where not public.is_user_banned(p.id)
  )
  select
    p.id,
    p.nickname,
    case when public.is_user_banned(p.id) then null else p.avatar_url end,
    case when public.is_user_banned(p.id) then null else p.banner_url end,
    case when public.is_user_banned(p.id) then '' else coalesce(p.bio, '') end,
    case when public.is_user_banned(p.id) then null else p.grade_level end,
    case when public.is_user_banned(p.id) then 0 else p.xp end,
    case when public.is_user_banned(p.id) then 0 else p.level end,
    case when public.is_user_banned(p.id) then 0 else p.streak_days end,
    p.created_at,
    case when public.is_user_banned(p.id) then 0 else coalesce(r.rating, 1200)::integer end,
    case when public.is_user_banned(p.id) then 0 else coalesce(r.peak_rating, 1200)::integer end,
    case when public.is_user_banned(p.id) then 0 else coalesce(r.games, 0)::integer end,
    case when public.is_user_banned(p.id) then 0 else coalesce(r.wins, 0)::integer end,
    case when public.is_user_banned(p.id) then 0 else coalesce(r.losses, 0)::integer end,
    case when public.is_user_banned(p.id) then 0 else coalesce(r.draws, 0)::integer end,
    case when public.is_user_banned(p.id) then 0 else coalesce(r.rated_events, 0)::integer end,
    coalesce(rr.global_rank, 0)::bigint,
    case when public.is_user_banned(p.id) then 0 else
      (select count(*) from public.user_badges ub where ub.user_id = p.id)::bigint
    end,
    public.is_user_banned(p.id)
  from public.profiles p
  left join rating_ranks rr on rr.id = p.id
  left join public.battle_ratings r on r.user_id = p.id
  where p.id = p_user_id and auth.uid() is not null;
$$;

create or replace function public.get_public_rating_history(
  p_user_id uuid,
  p_limit integer default 100
)
returns table(
  rating integer,
  rating_change integer,
  source text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select h.rating, h.rating_change, h.source, h.created_at
  from public.battle_rating_history h
  where h.user_id = p_user_id
    and auth.uid() is not null
    and not public.is_user_banned(p_user_id)
  order by h.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- PostgreSQL cannot change TABLE/OUT return columns through CREATE OR REPLACE.
-- Some deployed databases have an older return row type, so recreate the RPC.
drop function if exists public.search_message_users(text, integer);
create function public.search_message_users(p_query text, p_limit integer default 10)
returns table(id uuid, nickname text, avatar_url text, grade_level text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nickname, p.avatar_url, p.grade_level
  from public.profiles p
  where auth.uid() is not null
    and not public.is_user_banned(auth.uid())
    and not public.is_user_banned(p.id)
    and p.id <> auth.uid()
    and p.nickname ilike '%' || left(coalesce(p_query,''), 50) || '%'
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by p.nickname
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;

-- Direct table writes from a banned account are denied even if a stale page remains open.
create or replace function public.reject_banned_user_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_candidate uuid;
begin
  if tg_table_name = 'battle_matches' then
    if public.is_user_banned(nullif(v_row ->> 'player1_id', '')::uuid)
      or public.is_user_banned(nullif(v_row ->> 'player2_id', '')::uuid) then
      raise exception 'user is banned';
    end if;
    return new;
  end if;
  if tg_table_name = 'battle_challenges' then
    if public.is_user_banned(nullif(v_row ->> 'challenger_id', '')::uuid)
      or public.is_user_banned(nullif(v_row ->> 'target_id', '')::uuid) then
      raise exception 'user is banned';
    end if;
    return new;
  end if;
  if tg_table_name = 'direct_threads' then
    if public.is_user_banned(nullif(v_row ->> 'user1_id', '')::uuid)
      or public.is_user_banned(nullif(v_row ->> 'user2_id', '')::uuid) then
      raise exception 'user is banned';
    end if;
    return new;
  end if;

  v_candidate := coalesce(
    nullif(v_row ->> 'user_id', '')::uuid,
    nullif(v_row ->> 'sender_id', '')::uuid,
    auth.uid()
  );
  if public.is_user_banned(v_candidate) then raise exception 'user is banned'; end if;
  return new;
end;
$$;

drop trigger if exists reject_banned_forum_post_write on public.forum_posts;
create trigger reject_banned_forum_post_write
  before insert or update on public.forum_posts
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_forum_comment_write on public.forum_comments;
create trigger reject_banned_forum_comment_write
  before insert or update on public.forum_comments
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_forum_like_write on public.forum_likes;
create trigger reject_banned_forum_like_write
  before insert on public.forum_likes
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_direct_message_write on public.direct_messages;
create trigger reject_banned_direct_message_write
  before insert on public.direct_messages
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_battle_match_write on public.battle_matches;
create trigger reject_banned_battle_match_write
  before insert or update on public.battle_matches
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_battle_challenge_write on public.battle_challenges;
create trigger reject_banned_battle_challenge_write
  before insert or update on public.battle_challenges
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_battle_answer_write on public.battle_answers;
create trigger reject_banned_battle_answer_write
  before insert on public.battle_answers
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_contest_entry_write on public.contest_entries;
create trigger reject_banned_contest_entry_write
  before insert on public.contest_entries
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_contest_answer_write on public.contest_answers;
create trigger reject_banned_contest_answer_write
  before insert on public.contest_answers
  for each row execute function public.reject_banned_user_write();
drop trigger if exists reject_banned_direct_thread_write on public.direct_threads;
create trigger reject_banned_direct_thread_write
  before insert or update on public.direct_threads
  for each row execute function public.reject_banned_user_write();

grant execute on function public.get_rating_leaderboard(integer, integer, text, text) to authenticated;
grant execute on function public.get_leaderboard(integer) to authenticated;
grant execute on function public.get_battle_leaderboard(integer) to authenticated;
grant execute on function public.get_contest_leaderboard(uuid, integer) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_public_rating_history(uuid, integer) to authenticated;
grant execute on function public.search_message_users(text, integer) to authenticated;

notify pgrst, 'reload schema';
