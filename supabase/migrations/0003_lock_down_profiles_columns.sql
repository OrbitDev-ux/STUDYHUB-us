-- ---------------------------------------------------------------------------
-- profiles 테이블 컬럼 단위 권한 강화
--
-- 문제: "profiles_update_own" / "profiles_insert_own" RLS 정책은 행 소유권(auth.uid() = id)만
-- 검사할 뿐 컬럼을 제한하지 않는다. Supabase는 기본적으로 authenticated 롤에
-- 테이블 전체 컬럼에 대한 UPDATE/INSERT 권한을 부여하므로, 로그인한 사용자가
-- PostgREST(REST API)를 앱 코드 없이 직접 호출해
--   PATCH /rest/v1/profiles?id=eq.<self>  { "xp": 999999, "coins": 999999, "level": 99, "role": "admin" }
-- 를 보내면 그대로 통과한다. xp/coins/level/streak_days/role은 반드시
-- award_xp()/bump_streak() 같은 security definer 함수를 통해서만 바뀌어야 한다.
--
-- 해결: authenticated 롤의 profiles 테이블 UPDATE/INSERT 권한을 컬럼 단위로 재부여한다.
-- (INSERT는 handle_new_user() 트리거가 security definer로 처리하므로 클라이언트가
--  직접 행을 만들 필요가 없다 — INSERT 권한 자체를 회수한다.)
-- ---------------------------------------------------------------------------

revoke insert, update on public.profiles from authenticated;

grant update (
  nickname,
  avatar_url,
  banner_url,
  bio,
  grade_level,
  target_score,
  target_study_minutes,
  exam_date,
  updated_at,
  onboarding_completed
) on public.profiles to authenticated;

-- 클라이언트가 직접 행을 만들 이유가 없으므로 insert 정책도 제거한다.
drop policy if exists "profiles_insert_own" on public.profiles;
