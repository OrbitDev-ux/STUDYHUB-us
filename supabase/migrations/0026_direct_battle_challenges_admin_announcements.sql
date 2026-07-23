-- Direct user-to-user battle requests and enforced administrator forum notices.

create table if not exists public.battle_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  pair_low uuid not null references public.profiles(id) on delete cascade,
  pair_high uuid not null references public.profiles(id) on delete cascade,
  grade_level text not null check (grade_level in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')),
  subject_id text not null references public.subjects(id),
  question_keys jsonb not null check (jsonb_typeof(question_keys) = 'array'),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','expired')),
  match_id uuid references public.battle_matches(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint battle_challenge_players_different check (challenger_id <> target_id),
  constraint battle_challenge_pair_order check (pair_low < pair_high)
);

create unique index if not exists battle_challenges_one_pending_pair_idx
  on public.battle_challenges (pair_low, pair_high)
  where status = 'pending';
create index if not exists battle_challenges_target_pending_idx
  on public.battle_challenges (target_id, status, created_at desc);
create index if not exists battle_challenges_challenger_idx
  on public.battle_challenges (challenger_id, created_at desc);

alter table public.battle_challenges enable row level security;
drop policy if exists "battle_challenges_read_participant" on public.battle_challenges;
create policy "battle_challenges_read_participant"
  on public.battle_challenges for select
  using (auth.uid() in (challenger_id, target_id));

create or replace function public.create_battle_challenge(
  p_target_user_id uuid,
  p_grade_level text,
  p_subject_id text,
  p_question_keys jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_challenge_id uuid;
  v_challenger_name text;
  v_subject_name text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_target_user_id = v_user then raise exception 'cannot challenge yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'target user not found';
  end if;
  if p_grade_level not in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3') then
    raise exception 'invalid grade level';
  end if;
  if p_subject_id not in ('math','english','social','science') then
    raise exception 'invalid subject';
  end if;
  if jsonb_typeof(p_question_keys) <> 'array' or jsonb_array_length(p_question_keys) <> 5 then
    raise exception 'exactly five questions required';
  end if;

  update public.battle_challenges
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at <= now()
    and (challenger_id in (v_user, p_target_user_id) or target_id in (v_user, p_target_user_id));

  insert into public.battle_challenges (
    challenger_id, target_id, pair_low, pair_high,
    grade_level, subject_id, question_keys
  ) values (
    v_user,
    p_target_user_id,
    least(v_user, p_target_user_id),
    greatest(v_user, p_target_user_id),
    p_grade_level,
    p_subject_id,
    p_question_keys
  )
  returning id into v_challenge_id;

  select nickname into v_challenger_name from public.profiles where id = v_user;
  select name_ko into v_subject_name from public.subjects where id = p_subject_id;
  insert into public.notifications (user_id, type, title, body)
  values (
    p_target_user_id,
    'battle_challenge',
    '새로운 문제풀이 배틀 요청',
    format(
      '%s님이 %s · %s 5문제 대결을 요청했습니다. 24시간 안에 수락하거나 거절해주세요.',
      coalesce(v_challenger_name, '사용자'),
      p_grade_level,
      coalesce(v_subject_name, p_subject_id)
    )
  );
  return v_challenge_id;
exception
  when unique_violation then
    raise exception 'a pending challenge already exists between these users';
end;
$$;

create or replace function public.accept_battle_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  c public.battle_challenges%rowtype;
  v_match_id uuid;
  v_challenger_rating integer;
  v_target_rating integer;
  v_target_name text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into c from public.battle_challenges
  where id = p_challenge_id for update;
  if not found or c.target_id <> v_user then raise exception 'challenge not found'; end if;
  if c.status <> 'pending' then raise exception 'challenge is no longer pending'; end if;
  if c.expires_at <= now() then
    update public.battle_challenges set status = 'expired', updated_at = now() where id = c.id;
    raise exception 'challenge expired';
  end if;

  if exists (
    select 1 from public.battle_matches
    where status in ('waiting', 'active')
      and coalesce(expires_at, now() + interval '1 minute') > now()
      and (
        c.challenger_id in (player1_id, player2_id)
        or c.target_id in (player1_id, player2_id)
      )
  ) then
    raise exception 'one of the users is already in an active battle';
  end if;

  insert into public.battle_ratings (user_id) values (c.challenger_id)
  on conflict (user_id) do nothing;
  insert into public.battle_ratings (user_id) values (c.target_id)
  on conflict (user_id) do nothing;
  select rating into v_challenger_rating from public.battle_ratings where user_id = c.challenger_id;
  select rating into v_target_rating from public.battle_ratings where user_id = c.target_id;

  insert into public.battle_matches (
    grade_level, subject_id, status, player1_id, player2_id,
    question_keys, player1_rating_before, player2_rating_before,
    started_at, expires_at
  ) values (
    c.grade_level, c.subject_id, 'active', c.challenger_id, c.target_id,
    c.question_keys, v_challenger_rating, v_target_rating,
    now(), now() + interval '3 minutes'
  )
  returning id into v_match_id;

  update public.battle_challenges
  set status = 'accepted', match_id = v_match_id, updated_at = now()
  where id = c.id;

  select nickname into v_target_name from public.profiles where id = c.target_id;
  insert into public.notifications (user_id, type, title, body)
  values (
    c.challenger_id,
    'battle_challenge',
    '배틀 요청이 수락되었습니다',
    format('%s님이 배틀 요청을 수락했습니다. 배틀 화면에서 바로 입장하세요.', coalesce(v_target_name, '상대'))
  );
  return v_match_id;
end;
$$;

create or replace function public.respond_battle_challenge(
  p_challenge_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  c public.battle_challenges%rowtype;
  v_actor_name text;
  v_recipient uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_action not in ('decline', 'cancel') then raise exception 'invalid response'; end if;
  select * into c from public.battle_challenges where id = p_challenge_id for update;
  if not found or c.status <> 'pending' then raise exception 'challenge is no longer pending'; end if;
  if p_action = 'decline' and c.target_id <> v_user then raise exception 'only target can decline'; end if;
  if p_action = 'cancel' and c.challenger_id <> v_user then raise exception 'only challenger can cancel'; end if;

  update public.battle_challenges
  set status = case when p_action = 'decline' then 'declined' else 'cancelled' end,
      updated_at = now()
  where id = c.id;

  select nickname into v_actor_name from public.profiles where id = v_user;
  v_recipient := case when p_action = 'decline' then c.challenger_id else c.target_id end;
  insert into public.notifications (user_id, type, title, body)
  values (
    v_recipient,
    'battle_challenge',
    case when p_action = 'decline' then '배틀 요청이 거절되었습니다' else '배틀 요청이 취소되었습니다' end,
    format(
      '%s님이 배틀 요청을 %s했습니다.',
      coalesce(v_actor_name, '사용자'),
      case when p_action = 'decline' then '거절' else '취소' end
    )
  );
end;
$$;

revoke all on function public.create_battle_challenge(uuid, text, text, jsonb) from public, anon;
revoke all on function public.accept_battle_challenge(uuid) from public, anon;
revoke all on function public.respond_battle_challenge(uuid, text) from public, anon;
grant execute on function public.create_battle_challenge(uuid, text, text, jsonb) to authenticated;
grant execute on function public.accept_battle_challenge(uuid) to authenticated;
grant execute on function public.respond_battle_challenge(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'battle_challenges'
  ) then
    alter publication supabase_realtime add table public.battle_challenges;
  end if;
end $$;
alter table public.battle_challenges replica identity full;

-- Administrator-authored posts are always important notices.
create or replace function public.enforce_admin_forum_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and role = 'admin') then
    new.category := '공지';
    new.pinned := true;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_admin_forum_announcement_trigger on public.forum_posts;
create trigger enforce_admin_forum_announcement_trigger
before insert or update of category, pinned, user_id
on public.forum_posts
for each row execute function public.enforce_admin_forum_announcement();

drop policy if exists "forum_posts_insert_own" on public.forum_posts;
create policy "forum_posts_insert_own"
  on public.forum_posts for insert
  with check (
    auth.uid() = user_id
    and (
      (public.is_admin() and category = '공지' and pinned = true)
      or (not public.is_admin() and category <> '공지' and pinned = false)
    )
  );
drop policy if exists "forum_posts_update_own" on public.forum_posts;
create policy "forum_posts_update_own"
  on public.forum_posts for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      (public.is_admin() and category = '공지' and pinned = true)
      or (not public.is_admin() and category <> '공지' and pinned = false)
    )
  );

create or replace function public.notify_admin_forum_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and role = 'admin') then
    insert into public.notifications (user_id, type, title, body)
    select
      p.id,
      'forum_announcement',
      '중요 공지: ' || new.title,
      left(new.content, 500)
    from public.profiles p;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_admin_forum_announcement_trigger on public.forum_posts;
create trigger notify_admin_forum_announcement_trigger
after insert on public.forum_posts
for each row execute function public.notify_admin_forum_announcement();

create or replace function public.create_admin_forum_announcement(
  p_title text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  if not public.is_admin() then raise exception 'admin role required'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 2
    or char_length(trim(p_title)) > 120
    or char_length(trim(coalesce(p_content, ''))) < 2
    or char_length(trim(p_content)) > 10000 then
    raise exception 'invalid announcement content';
  end if;
  insert into public.forum_posts (user_id, category, title, content, pinned)
  values (auth.uid(), '공지', trim(p_title), trim(p_content), true)
  returning id into v_post_id;
  return v_post_id;
end;
$$;

revoke all on function public.create_admin_forum_announcement(text, text) from public, anon;
grant execute on function public.create_admin_forum_announcement(text, text) to authenticated;

update public.forum_posts post
set category = '공지', pinned = true, updated_at = now()
from public.profiles profile
where profile.id = post.user_id
  and profile.role = 'admin'
  and (post.category <> '공지' or post.pinned = false);

notify pgrst, 'reload schema';
