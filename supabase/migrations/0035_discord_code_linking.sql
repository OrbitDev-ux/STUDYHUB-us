-- One-time, hashed Discord linking codes.
-- The browser sees the plaintext once; Postgres only retains its SHA-256 hash.

create extension if not exists pgcrypto;

create table if not exists public.discord_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists discord_link_codes_expiry_idx
  on public.discord_link_codes (expires_at)
  where used_at is null;

create table if not exists public.discord_link_code_attempts (
  discord_user_id text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discord_link_codes enable row level security;
alter table public.discord_link_code_attempts enable row level security;
revoke all on public.discord_link_codes, public.discord_link_code_attempts
  from public, anon, authenticated;
grant all on public.discord_link_codes, public.discord_link_code_attempts
  to service_role;

create or replace function public.create_discord_link_code(p_code_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if public.is_user_banned(v_user_id) then raise exception 'banned user'; end if;
  if lower(coalesce(p_code_hash, '')) !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid code hash';
  end if;

  delete from public.discord_link_codes
  where expires_at < now() - interval '1 day';

  insert into public.discord_link_codes (
    user_id, code_hash, expires_at, used_at, created_at
  ) values (
    v_user_id, lower(p_code_hash), v_expires_at, null, now()
  )
  on conflict (user_id) do update
  set code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      used_at = null,
      created_at = now();

  return v_expires_at;
end;
$$;

revoke all on function public.create_discord_link_code(text) from public, anon;
grant execute on function public.create_discord_link_code(text) to authenticated;

create or replace function public.redeem_discord_link_code(
  p_code text,
  p_discord_user_id text,
  p_discord_username text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_discord_user_id text := trim(coalesce(p_discord_user_id, ''));
  v_discord_username text := left(trim(coalesce(p_discord_username, 'Discord User')), 100);
  v_attempt public.discord_link_code_attempts%rowtype;
  v_link_code public.discord_link_codes%rowtype;
  v_profile public.profiles%rowtype;
  v_rating integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if v_discord_user_id !~ '^[0-9]{10,25}$'
    or v_code !~ '^[A-HJ-NP-Z2-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  insert into public.discord_link_code_attempts (
    discord_user_id, failed_attempts, window_started_at, updated_at
  ) values (
    v_discord_user_id, 0, now(), now()
  )
  on conflict (discord_user_id) do update
  set failed_attempts = case
        when discord_link_code_attempts.window_started_at < now() - interval '15 minutes'
          then 0
        else discord_link_code_attempts.failed_attempts
      end,
      window_started_at = case
        when discord_link_code_attempts.window_started_at < now() - interval '15 minutes'
          then now()
        else discord_link_code_attempts.window_started_at
      end,
      updated_at = now()
  returning * into v_attempt;

  if v_attempt.failed_attempts >= 10 then
    return jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'retryAfter', v_attempt.window_started_at + interval '15 minutes'
    );
  end if;

  select * into v_link_code
  from public.discord_link_codes
  where code_hash = encode(digest(v_code, 'sha256'), 'hex')
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    update public.discord_link_code_attempts
    set failed_attempts = failed_attempts + 1, updated_at = now()
    where discord_user_id = v_discord_user_id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_profile
  from public.profiles
  where id = v_link_code.user_id
  for update;
  if not found or public.is_user_banned(v_link_code.user_id) then
    return jsonb_build_object('ok', false, 'error', 'account_unavailable');
  end if;

  -- A Discord identity belongs to one StudyHub account. Since redemption is
  -- initiated by that Discord identity, a previous link may safely be moved.
  delete from public.discord_links
  where discord_user_id = v_discord_user_id
    and user_id <> v_link_code.user_id;

  insert into public.discord_links (
    user_id, discord_user_id, discord_username, linked_at,
    premium_role_granted
  ) values (
    v_link_code.user_id,
    v_discord_user_id,
    v_discord_username,
    now(),
    v_profile.plan in ('basic', 'pro')
  )
  on conflict (user_id) do update
  set discord_user_id = excluded.discord_user_id,
      discord_username = excluded.discord_username,
      linked_at = now(),
      premium_role_granted = excluded.premium_role_granted;

  update public.discord_link_codes
  set used_at = now()
  where id = v_link_code.id;
  delete from public.discord_link_code_attempts
  where discord_user_id = v_discord_user_id;

  select coalesce(rating, 1200) into v_rating
  from public.battle_ratings
  where user_id = v_link_code.user_id;
  v_rating := coalesce(v_rating, 1200);

  insert into public.notifications (user_id, type, title, body)
  values (
    v_link_code.user_id,
    'discord_link',
    'Discord 계정이 연결되었습니다',
    format('%s 계정이 일회용 코드로 연결되었습니다.', v_discord_username)
  );

  return jsonb_build_object(
    'ok', true,
    'userId', v_link_code.user_id,
    'nickname', v_profile.nickname,
    'rating', v_rating
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'link_conflict');
end;
$$;

revoke all on function public.redeem_discord_link_code(text,text,text)
  from public, anon, authenticated;
grant execute on function public.redeem_discord_link_code(text,text,text)
  to service_role;

notify pgrst, 'reload schema';
