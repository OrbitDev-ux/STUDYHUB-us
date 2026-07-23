-- Public profile and complete Rating leaderboard.
-- Keep profiles RLS private; expose only explicitly approved public columns.

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
      p.id,
      p.nickname,
      p.avatar_url,
      p.grade_level,
      coalesce(r.rating, 1200)::integer as rating,
      coalesce(r.peak_rating, 1200)::integer as peak_rating,
      coalesce(r.games, 0)::integer as games,
      coalesce(r.wins, 0)::integer as wins,
      coalesce(r.losses, 0)::integer as losses,
      coalesce(r.draws, 0)::integer as draws,
      coalesce(r.rated_events, 0)::integer as rated_events
    from public.profiles p
    left join public.battle_ratings r on r.user_id = p.id
  ),
  filtered as (
    select ranked.*, count(*) over ()::bigint as total_count
    from ranked
    where (
      nullif(trim(left(coalesce(p_query, ''), 50)), '') is null
      or ranked.nickname ilike '%' || trim(left(p_query, 50)) || '%'
    )
    and (
      p_grade_level is null
      or p_grade_level = ''
      or ranked.grade_level = p_grade_level
    )
  )
  select
    filtered.global_rank,
    filtered.total_count,
    filtered.id,
    filtered.nickname,
    filtered.avatar_url,
    filtered.grade_level,
    filtered.rating,
    filtered.peak_rating,
    filtered.games,
    filtered.wins,
    filtered.losses,
    filtered.draws,
    filtered.rated_events
  from filtered
  where auth.uid() is not null
  order by filtered.global_rank, filtered.games desc, filtered.nickname
  limit least(greatest(coalesce(p_page_size, 50), 1), 100)
  offset (
    least(greatest(coalesce(p_page, 1), 1), 10000) - 1
  ) * least(greatest(coalesce(p_page_size, 50), 1), 100);
$$;

grant execute on function public.get_rating_leaderboard(integer, integer, text, text) to authenticated;

drop function if exists public.get_leaderboard(integer);
create function public.get_leaderboard(limit_count integer default 20)
returns table(
  id uuid,
  nickname text,
  avatar_url text,
  xp integer,
  level integer,
  streak_days integer,
  rating integer
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
  where auth.uid() is not null
  order by p.xp desc, p.streak_days desc
  limit least(greatest(coalesce(limit_count, 20), 1), 100);
$$;

grant execute on function public.get_leaderboard(integer) to authenticated;

create or replace function public.get_public_profile(p_user_id uuid)
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
  badge_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with rating_ranks as (
    select
      p.id,
      rank() over (order by coalesce(r.rating, 1200) desc)::bigint as global_rank
    from public.profiles p
    left join public.battle_ratings r on r.user_id = p.id
  )
  select
    p.id,
    p.nickname,
    p.avatar_url,
    p.banner_url,
    coalesce(p.bio, ''),
    p.grade_level,
    p.xp,
    p.level,
    p.streak_days,
    p.created_at,
    coalesce(r.rating, 1200)::integer,
    coalesce(r.peak_rating, 1200)::integer,
    coalesce(r.games, 0)::integer,
    coalesce(r.wins, 0)::integer,
    coalesce(r.losses, 0)::integer,
    coalesce(r.draws, 0)::integer,
    coalesce(r.rated_events, 0)::integer,
    rr.global_rank,
    (select count(*) from public.user_badges ub where ub.user_id = p.id)::bigint
  from public.profiles p
  join rating_ranks rr on rr.id = p.id
  left join public.battle_ratings r on r.user_id = p.id
  where p.id = p_user_id and auth.uid() is not null;
$$;

grant execute on function public.get_public_profile(uuid) to authenticated;

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
  where h.user_id = p_user_id and auth.uid() is not null
  order by h.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

grant execute on function public.get_public_rating_history(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
