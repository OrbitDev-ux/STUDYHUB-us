-- Highest-operator role and traceable Audit Log editing.
-- Original audit snapshots are append-only in developer_audit_log_revisions.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
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
    where id = auth.uid() and role = 'super_admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- Rebind legacy administrator RPCs that compared role='admin' directly.
create or replace function public.set_maintenance_mode(p_enabled boolean, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required'; end if;
  update public.app_settings
  set maintenance_mode = p_enabled,
      maintenance_message = p_message,
      updated_at = now()
  where id = true;
end;
$$;

create or replace function public.set_user_plan(p_target_user_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin role required'; end if;
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

grant execute on function public.set_maintenance_mode(boolean, text) to authenticated;
grant execute on function public.set_user_plan(uuid, text) to authenticated;

-- Bootstrap one highest operator while preserving every other administrator.
update public.profiles
set role = 'super_admin', updated_at = now()
where id = (
  select id from public.profiles
  where role = 'admin'
  order by created_at asc, id asc
  limit 1
)
and not exists (select 1 from public.profiles where role = 'super_admin');

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
  -- Serialize role changes so two concurrent demotions cannot remove every Super Admin.
  perform pg_advisory_xact_lock(731942861::bigint);
  if p_role not in ('user', 'admin', 'super_admin') then raise exception 'invalid role'; end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 300 then
    raise exception 'role change reason must be 5 to 300 characters';
  end if;

  select role into v_before from public.profiles
  where id = p_target_user_id for update;
  if not found then raise exception 'target user not found'; end if;
  if p_target_user_id = auth.uid() and p_role <> 'super_admin' then
    raise exception 'cannot demote current super admin session';
  end if;
  if v_before = 'super_admin' and p_role <> 'super_admin'
    and (select count(*) from public.profiles where role = 'super_admin') <= 1 then
    raise exception 'at least one super admin is required';
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

revoke all on function public.super_admin_set_user_role(uuid, text, text) from public, anon;
grant execute on function public.super_admin_set_user_role(uuid, text, text) to authenticated;

alter table public.developer_audit_logs
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

create table if not exists public.developer_audit_log_revisions (
  id uuid primary key default gen_random_uuid(),
  audit_log_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  operation text not null check (operation in ('update', 'archive', 'restore')),
  reason text not null,
  before_snapshot jsonb not null,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists developer_audit_log_revisions_log_idx
  on public.developer_audit_log_revisions (audit_log_id, created_at desc);
create index if not exists developer_audit_logs_archive_date_idx
  on public.developer_audit_logs (archived_at, created_at desc);

alter table public.developer_audit_log_revisions enable row level security;

create or replace function public.super_admin_update_audit_log(
  p_audit_log_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.developer_audit_logs%rowtype;
  v_after public.developer_audit_logs%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.is_super_admin() then raise exception 'super admin role required'; end if;
  if char_length(trim(coalesce(p_action, ''))) < 2 or char_length(trim(p_action)) > 100
    or char_length(trim(coalesce(p_target_type, ''))) < 1 or char_length(trim(p_target_type)) > 100
    or char_length(coalesce(p_target_id, '')) > 200
    or jsonb_typeof(coalesce(p_details, '{}'::jsonb)) <> 'object'
    or char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'invalid audit log edit';
  end if;

  select * into v_before from public.developer_audit_logs
  where id = p_audit_log_id for update;
  if not found then raise exception 'audit log not found'; end if;

  update public.developer_audit_logs
  set
    action = trim(p_action),
    target_type = trim(p_target_type),
    target_id = nullif(trim(coalesce(p_target_id, '')), ''),
    details = coalesce(p_details, '{}'::jsonb),
    edited_at = now(),
    edited_by = auth.uid()
  where id = p_audit_log_id
  returning * into v_after;

  insert into public.developer_audit_log_revisions (
    audit_log_id, actor_id, operation, reason, before_snapshot, after_snapshot
  ) values (
    p_audit_log_id, auth.uid(), 'update', v_reason,
    to_jsonb(v_before), to_jsonb(v_after)
  );

  insert into public.developer_audit_logs (
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(),
    'audit.update',
    'audit_log',
    p_audit_log_id::text,
    jsonb_build_object(
      'reason', v_reason,
      'originalAction', v_before.action,
      'updatedAction', v_after.action,
      'revisionPreserved', true
    )
  );
end;
$$;

create or replace function public.super_admin_set_audit_log_archived(
  p_audit_log_id uuid,
  p_archived boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.developer_audit_logs%rowtype;
  v_after public.developer_audit_logs%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_operation text;
begin
  if not public.is_super_admin() then raise exception 'super admin role required'; end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'archive reason must be 5 to 500 characters';
  end if;

  select * into v_before from public.developer_audit_logs
  where id = p_audit_log_id for update;
  if not found then raise exception 'audit log not found'; end if;
  v_operation := case when p_archived then 'archive' else 'restore' end;

  update public.developer_audit_logs
  set
    archived_at = case when p_archived then now() else null end,
    archived_by = case when p_archived then auth.uid() else null end,
    archive_reason = case when p_archived then v_reason else null end
  where id = p_audit_log_id
  returning * into v_after;

  insert into public.developer_audit_log_revisions (
    audit_log_id, actor_id, operation, reason, before_snapshot, after_snapshot
  ) values (
    p_audit_log_id, auth.uid(), v_operation, v_reason,
    to_jsonb(v_before), to_jsonb(v_after)
  );

  insert into public.developer_audit_logs (
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(),
    case when p_archived then 'audit.archive' else 'audit.restore' end,
    'audit_log',
    p_audit_log_id::text,
    jsonb_build_object(
      'reason', v_reason,
      'affectedAction', v_before.action,
      'revisionPreserved', true
    )
  );
end;
$$;

revoke all on function public.super_admin_update_audit_log(uuid, text, text, text, jsonb, text) from public, anon;
revoke all on function public.super_admin_set_audit_log_archived(uuid, boolean, text) from public, anon;
grant execute on function public.super_admin_update_audit_log(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.super_admin_set_audit_log_archived(uuid, boolean, text) to authenticated;

-- Keep administrator-authored forum announcements working for both operator roles.
create or replace function public.enforce_admin_forum_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = new.user_id and role in ('admin', 'super_admin')
  ) then
    new.category := '공지';
    new.pinned := true;
  end if;
  return new;
end;
$$;

create or replace function public.notify_admin_forum_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = new.user_id and role in ('admin', 'super_admin')
  ) then
    insert into public.notifications (user_id, type, title, body)
    select p.id, 'forum_announcement', '중요 공지: ' || new.title, left(new.content, 500)
    from public.profiles p;
  end if;
  return new;
end;
$$;

update public.forum_posts post
set category = '공지', pinned = true, updated_at = now()
from public.profiles profile
where profile.id = post.user_id
  and profile.role in ('admin', 'super_admin')
  and (post.category <> '공지' or post.pinned = false);

notify pgrst, 'reload schema';
