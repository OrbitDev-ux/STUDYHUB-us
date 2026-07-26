-- ---------------------------------------------------------------------------
-- Discord 봇의 "레이팅 조회 패널"이 쓸 RPC.
--
-- 봇은 Discord 인터랙션에서 얻은 discord_user_id만 가지고 있으므로, discord_links로
-- StudyHub user_id를 찾아 레이팅/전적/순위를 계산해 반환한다.
--
-- get_public_profile()(0020/0028)을 내부에서 호출해 재사용하고 싶었지만, 그 함수는
-- `where ... and auth.uid() is not null` 가드가 있어 브라우저 세션(authenticated)
-- 전제로 설계돼 있다 — service_role 호출은 auth.uid()가 null이라 항상 빈 결과가
-- 나온다. 그래서 동일한 global_rank 계산(rank() over (order by rating desc))만
-- 여기 그대로 옮겨왔다. 이후 순위 계산 방식이 바뀌면 두 함수 모두 같이 수정해야 한다.
--
-- redeem_discord_link_code(0035)와 동일하게 service_role 전용 — 봇 프로세스만 호출.
-- ---------------------------------------------------------------------------

create or replace function public.get_discord_rating_summary(p_discord_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid;
  v_profile record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  if trim(coalesce(p_discord_user_id, '')) !~ '^[0-9]{10,25}$' then
    return jsonb_build_object('linked', false);
  end if;

  select user_id into v_user_id
  from public.discord_links
  where discord_user_id = trim(p_discord_user_id);

  if v_user_id is null then
    return jsonb_build_object('linked', false);
  end if;

  select
    p.nickname,
    public.is_user_banned(p.id) as is_banned,
    coalesce(r.rating, 1200)::integer as rating,
    coalesce(r.peak_rating, 1200)::integer as peak_rating,
    coalesce(r.games, 0)::integer as games,
    coalesce(r.wins, 0)::integer as wins,
    coalesce(r.losses, 0)::integer as losses,
    coalesce(r.draws, 0)::integer as draws,
    rr.global_rank
  into v_profile
  from public.profiles p
  left join public.battle_ratings r on r.user_id = p.id
  left join (
    select id, rank() over (order by coalesce(br.rating, 1200) desc)::bigint as global_rank
    from public.profiles pp
    left join public.battle_ratings br on br.user_id = pp.id
    where not public.is_user_banned(pp.id)
  ) rr on rr.id = p.id
  where p.id = v_user_id;

  if not found then
    return jsonb_build_object('linked', false);
  end if;

  return jsonb_build_object(
    'linked', true,
    'isBanned', v_profile.is_banned,
    'nickname', v_profile.nickname,
    'rating', v_profile.rating,
    'peakRating', v_profile.peak_rating,
    'games', v_profile.games,
    'wins', v_profile.wins,
    'losses', v_profile.losses,
    'draws', v_profile.draws,
    'globalRank', v_profile.global_rank
  );
end;
$$;

revoke all on function public.get_discord_rating_summary(text) from public, anon, authenticated;
grant execute on function public.get_discord_rating_summary(text) to service_role;

notify pgrst, 'reload schema';
