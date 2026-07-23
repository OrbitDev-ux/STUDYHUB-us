-- Direct-message safety: immutable report snapshots, moderator workflow,
-- chat restrictions, and database-level burst protection.

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  message_id uuid references public.direct_messages(id) on delete set null,
  category text not null check (category in (
    'spam', 'harassment', 'inappropriate', 'personal_info', 'threat', 'other'
  )),
  reason text not null check (char_length(reason) between 3 and 1000),
  message_snapshot text not null,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolution text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reporter_id, message_id),
  check (reporter_id <> reported_user_id)
);

create table if not exists public.chat_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  restricted_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_reports_status_date_idx
  on public.message_reports (status, created_at desc);
create index if not exists message_reports_reported_date_idx
  on public.message_reports (reported_user_id, created_at desc);
create index if not exists chat_restrictions_until_idx
  on public.chat_restrictions (restricted_until);

alter table public.message_reports enable row level security;
alter table public.chat_restrictions enable row level security;

drop policy if exists "message_reports_select_own" on public.message_reports;
create policy "message_reports_select_own"
  on public.message_reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "chat_restrictions_select_own" on public.chat_restrictions;
create policy "chat_restrictions_select_own"
  on public.chat_restrictions for select
  using (auth.uid() = user_id);

create or replace function public.report_direct_message(
  p_message_id uuid,
  p_category text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_message public.direct_messages%rowtype;
  v_thread public.direct_threads%rowtype;
  v_report_id uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_category not in ('spam', 'harassment', 'inappropriate', 'personal_info', 'threat', 'other')
    or char_length(trim(coalesce(p_reason, ''))) not between 3 and 1000 then
    raise exception 'invalid report';
  end if;

  select * into v_message from public.direct_messages where id = p_message_id;
  if not found then raise exception 'message not found'; end if;
  select * into v_thread from public.direct_threads where id = v_message.thread_id;
  if not found or v_user not in (v_thread.user1_id, v_thread.user2_id)
    or v_message.sender_id = v_user then
    raise exception 'message cannot be reported';
  end if;

  insert into public.message_reports (
    reporter_id, reported_user_id, thread_id, message_id,
    category, reason, message_snapshot
  ) values (
    v_user, v_message.sender_id, v_message.thread_id, v_message.id,
    p_category, trim(p_reason), v_message.content
  )
  on conflict (reporter_id, message_id) do update set
    category = excluded.category,
    reason = excluded.reason,
    message_snapshot = excluded.message_snapshot,
    status = 'pending',
    resolution = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
  returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.report_direct_message(uuid, text, text)
  from public, anon;
grant execute on function public.report_direct_message(uuid, text, text)
  to authenticated;

create or replace function public.send_direct_message(
  p_thread_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  t public.direct_threads%rowtype;
  v_id uuid;
begin
  if v_user is null
    or char_length(trim(coalesce(p_content, ''))) not between 1 and 2000 then
    raise exception 'invalid message';
  end if;
  if exists (
    select 1 from public.chat_restrictions r
    where r.user_id = v_user
      and (r.restricted_until is null or r.restricted_until > now())
  ) then
    raise exception 'chat restricted';
  end if;
  if (
    select count(*) from public.direct_messages m
    where m.sender_id = v_user and m.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'message rate limit';
  end if;

  select * into t from public.direct_threads
  where id = p_thread_id and v_user in (user1_id, user2_id);
  if not found then raise exception 'thread not found'; end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = t.user1_id and blocked_id = t.user2_id)
       or (blocker_id = t.user2_id and blocked_id = t.user1_id)
  ) then
    raise exception 'conversation unavailable';
  end if;

  insert into public.direct_messages (thread_id, sender_id, content)
  values (t.id, v_user, trim(p_content))
  returning id into v_id;
  update public.direct_threads set updated_at = now() where id = t.id;
  return v_id;
end;
$$;

grant execute on function public.send_direct_message(uuid, text)
  to authenticated;

create or replace function public.get_direct_thread_summaries()
returns table(
  thread_id uuid,
  opponent_id uuid,
  nickname text,
  avatar_url text,
  grade_level text,
  rating integer,
  last_message text,
  updated_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    p.id,
    p.nickname,
    p.avatar_url,
    p.grade_level,
    coalesce(br.rating, 1200),
    coalesce(lm.content, '대화를 시작해보세요.'),
    t.updated_at,
    (
      select count(*)
      from public.direct_messages unread
      where unread.thread_id = t.id
        and unread.sender_id <> auth.uid()
        and unread.read_at is null
    )
  from public.direct_threads t
  join public.profiles p on p.id = case
    when t.user1_id = auth.uid() then t.user2_id
    else t.user1_id
  end
  left join public.battle_ratings br on br.user_id = p.id
  left join lateral (
    select m.content
    from public.direct_messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where auth.uid() is not null
    and auth.uid() in (t.user1_id, t.user2_id)
  order by t.updated_at desc;
$$;

revoke all on function public.get_direct_thread_summaries()
  from public, anon;
grant execute on function public.get_direct_thread_summaries()
  to authenticated;

notify pgrst, 'reload schema';
