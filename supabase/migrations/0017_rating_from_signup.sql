-- =========================================================
-- 가입 즉시 1200 ELO 생성 + 가입일 그래프 시작점
-- =========================================================

-- 기존 사용자에게도 레이팅 행을 보장한다. 0016의 trigger가 초기 이력을 함께 만든다.
insert into public.battle_ratings (user_id, rating, peak_rating)
select p.id, 1200, 1200 from public.profiles p
on conflict (user_id) do nothing;

insert into public.battle_rating_history (user_id, rating, rating_change, source, created_at)
select r.user_id, r.rating, 0, 'signup', u.created_at
from public.battle_ratings r join auth.users u on u.id = r.user_id
where not exists (select 1 from public.battle_rating_history h where h.user_id = r.user_id);

-- 각 사용자의 첫 0변동 지점을 실제 auth 가입일로 이동한다.
with first_points as (
  select distinct on (h.user_id) h.id, h.user_id
  from public.battle_rating_history h
  order by h.user_id, h.created_at asc, h.id asc
)
update public.battle_rating_history h
set created_at = u.created_at, source = 'signup'
from first_points f join auth.users u on u.id = f.user_id
where h.id = f.id and h.rating_change = 0;

-- 앞으로 가입하는 사용자는 프로필/설정과 동시에 1200점 레이팅을 만든다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_history_id uuid;
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '학생'
    )
  ) on conflict (id) do nothing;

  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.battle_ratings (user_id, rating, peak_rating) values (new.id, 1200, 1200)
  on conflict (user_id) do nothing;

  select id into v_history_id from public.battle_rating_history
  where user_id = new.id order by created_at asc, id asc limit 1;
  if v_history_id is not null then
    update public.battle_rating_history set created_at = new.created_at, source = 'signup'
    where id = v_history_id;
  end if;
  return new;
end;
$$;

-- 대회 순위표에서도 참가자의 현재 Codeforces식 레이팅 색상을 표시한다.
drop function if exists public.get_contest_leaderboard(uuid, integer);
create function public.get_contest_leaderboard(p_contest_id uuid, p_limit integer default 100)
returns table(user_id uuid, nickname text, avatar_url text, rating integer, score integer, solved integer, penalty_seconds integer, finished_at timestamptz)
language sql security definer set search_path = public stable as $$
  select e.user_id, p.nickname, p.avatar_url, coalesce(r.rating, 1200), e.score, e.solved, e.penalty_seconds, e.finished_at
  from public.contest_entries e
  join public.profiles p on p.id = e.user_id
  left join public.battle_ratings r on r.user_id = e.user_id
  where e.contest_id = p_contest_id and auth.uid() is not null
  order by e.score desc, e.penalty_seconds asc, e.started_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;
grant execute on function public.get_contest_leaderboard(uuid, integer) to authenticated;

drop function if exists public.search_message_users(text, integer);
create function public.search_message_users(p_query text, p_limit integer default 10)
returns table(id uuid, nickname text, avatar_url text, grade_level text, rating integer)
language sql security definer set search_path = public stable as $$
  select p.id, p.nickname, p.avatar_url, p.grade_level, coalesce(r.rating, 1200)
  from public.profiles p left join public.battle_ratings r on r.user_id = p.id
  where auth.uid() is not null and p.id <> auth.uid() and p.nickname ilike '%' || left(coalesce(p_query,''), 50) || '%'
    and not exists (select 1 from public.user_blocks b where (b.blocker_id = auth.uid() and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = auth.uid()))
  order by p.nickname limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;
grant execute on function public.search_message_users(text, integer) to authenticated;

notify pgrst, 'reload schema';
