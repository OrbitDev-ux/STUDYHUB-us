-- =========================================================
-- 레이팅 이력, 대회, 포럼, 1:1 메시지
-- =========================================================

-- ---------- Codeforces형 레이팅 이력 ----------
create table if not exists public.battle_rating_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null,
  rating_change integer not null default 0,
  source text not null default 'battle',
  created_at timestamptz not null default now()
);
create index if not exists battle_rating_history_user_date on public.battle_rating_history (user_id, created_at);
alter table public.battle_rating_history enable row level security;
create policy "battle_rating_history_select_own" on public.battle_rating_history for select using (auth.uid() = user_id);

create or replace function public.capture_battle_rating_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
drop trigger if exists battle_rating_history_trigger on public.battle_ratings;
create trigger battle_rating_history_trigger after insert or update of rating on public.battle_ratings
for each row execute function public.capture_battle_rating_history();
insert into public.battle_rating_history (user_id, rating, rating_change, source)
select r.user_id, r.rating, 0, 'backfill' from public.battle_ratings r
where not exists (select 1 from public.battle_rating_history h where h.user_id = r.user_id);

-- ---------- 대회 ----------
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  grade_level text not null check (grade_level in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')),
  subject_id text not null references public.subjects(id),
  question_keys jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (jsonb_typeof(question_keys) = 'array' and jsonb_array_length(question_keys) between 5 and 16)
);
create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null default 0,
  solved integer not null default 0,
  penalty_seconds integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (contest_id, user_id)
);
create table if not exists public.contest_answers (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,
  user_answer text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (contest_id, user_id, question_key)
);
create index if not exists contests_schedule_idx on public.contests (starts_at desc, ends_at desc);
create index if not exists contest_entries_standing_idx on public.contest_entries (contest_id, score desc, penalty_seconds asc);
alter table public.contests enable row level security;
alter table public.contest_entries enable row level security;
alter table public.contest_answers enable row level security;
create policy "contests_read_authenticated" on public.contests for select using (auth.uid() is not null);
create policy "contest_entries_select_own" on public.contest_entries for select using (auth.uid() = user_id);
create policy "contest_answers_select_own" on public.contest_answers for select using (auth.uid() = user_id);

create or replace function public.record_contest_answer(
  p_user_id uuid, p_contest_id uuid, p_question_key text, p_user_answer text, p_is_correct boolean
)
returns table(current_score integer, current_solved integer)
language plpgsql security definer set search_path = public as $$
declare
  c public.contests%rowtype;
  e public.contest_entries%rowtype;
  v_count integer;
begin
  select * into c from public.contests where id = p_contest_id;
  if not found or now() < c.starts_at or now() > c.ends_at then raise exception 'contest is not active'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and grade_level = c.grade_level) then raise exception 'grade mismatch'; end if;
  if not (c.question_keys ? p_question_key) or char_length(p_user_answer) > 500 then raise exception 'invalid answer'; end if;
  if exists (select 1 from public.contest_answers where contest_id = c.id and user_id = p_user_id and question_key = p_question_key) then raise exception 'question already answered'; end if;

  insert into public.contest_entries (contest_id, user_id) values (c.id, p_user_id)
  on conflict (contest_id, user_id) do nothing;
  insert into public.contest_answers (contest_id, user_id, question_key, user_answer, is_correct)
  values (c.id, p_user_id, p_question_key, p_user_answer, p_is_correct);
  update public.contest_entries set
    score = score + case when p_is_correct then 100 else 0 end,
    solved = solved + case when p_is_correct then 1 else 0 end,
    penalty_seconds = penalty_seconds + case when p_is_correct then greatest(0, extract(epoch from (now() - c.starts_at))::integer) else 0 end
  where contest_id = c.id and user_id = p_user_id returning * into e;
  select count(*) into v_count from public.contest_answers where contest_id = c.id and user_id = p_user_id;
  if v_count >= jsonb_array_length(c.question_keys) then
    update public.contest_entries set finished_at = now() where id = e.id;
  end if;
  return query select e.score, e.solved;
end;
$$;
revoke all on function public.record_contest_answer(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_contest_answer(uuid, uuid, text, text, boolean) to service_role;

create or replace function public.get_contest_leaderboard(p_contest_id uuid, p_limit integer default 100)
returns table(user_id uuid, nickname text, avatar_url text, score integer, solved integer, penalty_seconds integer, finished_at timestamptz)
language sql security definer set search_path = public stable as $$
  select e.user_id, p.nickname, p.avatar_url, e.score, e.solved, e.penalty_seconds, e.finished_at
  from public.contest_entries e join public.profiles p on p.id = e.user_id
  where e.contest_id = p_contest_id and auth.uid() is not null
  order by e.score desc, e.penalty_seconds asc, e.started_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;
grant execute on function public.get_contest_leaderboard(uuid, integer) to authenticated;

-- ---------- 포럼 ----------
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default '자유' check (category in ('자유','질문','공부팁','대회','공지')),
  title text not null check (char_length(title) between 2 and 120),
  content text not null check (char_length(content) between 2 and 10000),
  pinned boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.forum_likes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists forum_posts_recent_idx on public.forum_posts (pinned desc, created_at desc);
create index if not exists forum_comments_post_idx on public.forum_comments (post_id, created_at);
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_likes enable row level security;
create policy "forum_posts_read" on public.forum_posts for select using (auth.uid() is not null);
create policy "forum_posts_insert_own" on public.forum_posts for insert with check (auth.uid() = user_id and pinned = false and (category <> '공지' or public.is_admin()));
create policy "forum_posts_update_own" on public.forum_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id and pinned = false and (category <> '공지' or public.is_admin()));
create policy "forum_posts_delete_own" on public.forum_posts for delete using (auth.uid() = user_id);
create policy "forum_comments_read" on public.forum_comments for select using (auth.uid() is not null);
create policy "forum_comments_insert_own" on public.forum_comments for insert with check (auth.uid() = user_id);
create policy "forum_comments_update_own" on public.forum_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "forum_comments_delete_own" on public.forum_comments for delete using (auth.uid() = user_id);
create policy "forum_likes_read" on public.forum_likes for select using (auth.uid() is not null);
create policy "forum_likes_insert_own" on public.forum_likes for insert with check (auth.uid() = user_id);
create policy "forum_likes_delete_own" on public.forum_likes for delete using (auth.uid() = user_id);

create or replace function public.increment_forum_views(p_post_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.forum_posts set views = views + 1 where id = p_post_id and auth.uid() is not null;
$$;
grant execute on function public.increment_forum_views(uuid) to authenticated;

-- ---------- 사용자 차단 및 1:1 메시지 ----------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id), check (blocker_id <> blocked_id)
);
create table if not exists public.direct_threads (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references auth.users(id) on delete cascade,
  user2_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user1_id <> user2_id), unique (user1_id, user2_id)
);
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists direct_threads_updated_idx on public.direct_threads (updated_at desc);
create index if not exists direct_messages_thread_idx on public.direct_messages (thread_id, created_at);
alter table public.user_blocks enable row level security;
alter table public.direct_threads enable row level security;
alter table public.direct_messages enable row level security;
create policy "user_blocks_select_own" on public.user_blocks for select using (auth.uid() = blocker_id);
create policy "user_blocks_insert_own" on public.user_blocks for insert with check (auth.uid() = blocker_id);
create policy "user_blocks_delete_own" on public.user_blocks for delete using (auth.uid() = blocker_id);
create policy "direct_threads_select_member" on public.direct_threads for select using (auth.uid() in (user1_id, user2_id));
create policy "direct_messages_select_member" on public.direct_messages for select using (
  exists (select 1 from public.direct_threads t where t.id = thread_id and auth.uid() in (t.user1_id, t.user2_id))
);
create policy "direct_messages_insert_member" on public.direct_messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.direct_threads t where t.id = thread_id and auth.uid() in (t.user1_id, t.user2_id)
      and not exists (select 1 from public.user_blocks b where (b.blocker_id = t.user1_id and b.blocked_id = t.user2_id) or (b.blocker_id = t.user2_id and b.blocked_id = t.user1_id))
  )
);

create or replace function public.send_direct_message(p_thread_id uuid, p_content text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); t public.direct_threads%rowtype; v_id uuid;
begin
  if v_user is null or char_length(trim(coalesce(p_content, ''))) not between 1 and 2000 then raise exception 'invalid message'; end if;
  select * into t from public.direct_threads where id = p_thread_id and v_user in (user1_id, user2_id);
  if not found then raise exception 'thread not found'; end if;
  if exists (select 1 from public.user_blocks where (blocker_id = t.user1_id and blocked_id = t.user2_id) or (blocker_id = t.user2_id and blocked_id = t.user1_id)) then raise exception 'conversation unavailable'; end if;
  insert into public.direct_messages (thread_id, sender_id, content) values (t.id, v_user, trim(p_content)) returning id into v_id;
  update public.direct_threads set updated_at = now() where id = t.id;
  return v_id;
end;
$$;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

create or replace function public.get_or_create_direct_thread(p_other_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_first uuid; v_second uuid; v_id uuid;
begin
  if v_user is null or p_other_user = v_user or not exists (select 1 from public.profiles where id = p_other_user) then raise exception 'invalid recipient'; end if;
  if exists (select 1 from public.user_blocks where (blocker_id = v_user and blocked_id = p_other_user) or (blocker_id = p_other_user and blocked_id = v_user)) then raise exception 'conversation unavailable'; end if;
  v_first := least(v_user, p_other_user); v_second := greatest(v_user, p_other_user);
  insert into public.direct_threads (user1_id, user2_id) values (v_first, v_second)
  on conflict (user1_id, user2_id) do update set updated_at = public.direct_threads.updated_at
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.get_or_create_direct_thread(uuid) to authenticated;

create or replace function public.mark_direct_thread_read(p_thread_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.direct_messages m set read_at = coalesce(read_at, now())
  where m.thread_id = p_thread_id and m.sender_id <> auth.uid()
    and exists (select 1 from public.direct_threads t where t.id = p_thread_id and auth.uid() in (t.user1_id, t.user2_id));
$$;
grant execute on function public.mark_direct_thread_read(uuid) to authenticated;

create or replace function public.search_message_users(p_query text, p_limit integer default 10)
returns table(id uuid, nickname text, avatar_url text, grade_level text)
language sql security definer set search_path = public stable as $$
  select p.id, p.nickname, p.avatar_url, p.grade_level from public.profiles p
  where auth.uid() is not null and p.id <> auth.uid() and p.nickname ilike '%' || left(coalesce(p_query,''), 50) || '%'
    and not exists (select 1 from public.user_blocks b where (b.blocker_id = auth.uid() and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = auth.uid()))
  order by p.nickname limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;
grant execute on function public.search_message_users(text, integer) to authenticated;

notify pgrst, 'reload schema';
