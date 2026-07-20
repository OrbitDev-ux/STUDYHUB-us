-- ---------------------------------------------------------------------------
-- lib/rate-limit.ts는 지금까지 "최근 시도 수 조회 → 이번 시도 기록"을 애플리케이션
-- 레벨에서 두 번의 별개 쿼리로 처리했다. 이 둘 사이에는 트랜잭션/락이 없어서,
-- 같은 key로 여러 요청이 동시에(버스트로) 들어오면 전부 같은 count를 보고 통과한
-- 뒤에야 각자 기록되므로 설정한 시도 횟수 제한을 우회할 수 있었다.
--
-- key(이메일/IP) 단위 advisory lock으로 조회+기록을 하나의 트랜잭션 안에서
-- 원자적으로 처리하는 RPC로 옮긴다. service_role(admin 클라이언트)에서만 호출한다.
-- ---------------------------------------------------------------------------

create or replace function public.check_and_record_attempt(
  p_key text,
  p_max_attempts integer,
  p_window_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - (p_window_ms || ' milliseconds')::interval;
  v_count integer;
begin
  -- 같은 key에 대한 동시 호출을 트랜잭션이 끝날 때까지 직렬화한다.
  perform pg_advisory_xact_lock(hashtext(p_key));

  select count(*) into v_count
  from public.auth_attempts
  where key = p_key and created_at >= v_since;

  insert into public.auth_attempts (key) values (p_key);

  return v_count >= p_max_attempts;
end;
$$;

grant execute on function public.check_and_record_attempt(text, integer, integer) to service_role;
