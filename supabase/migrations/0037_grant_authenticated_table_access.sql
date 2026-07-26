-- ---------------------------------------------------------------------------
-- authenticated/anon 롤에 대한 테이블 단위 base GRANT 복구.
--
-- 문제: 0001_init.sql은 RLS 정책만 만들고 테이블 자체의 GRANT SELECT/INSERT/
-- UPDATE/DELETE는 authenticated/anon에 한 번도 내준 적이 없다. 예전 Supabase
-- 프로젝트에서는 "새로 만든 public 테이블을 자동으로 API 롤에 노출"하는 legacy
-- 기본값(auto_expose_new_tables)이 켜져 있어서 이게 문제가 되지 않았지만, 최신
-- Supabase(로컬 CLI 신규 프로젝트 및 새 클라우드 기본값)는 이 legacy 자동 노출을
-- 끈 채로 시작한다. 그 결과 온보딩에서 profiles를 업데이트하려고만 해도
-- "permission denied for table profiles"가 난다 — RLS 정책은 있는데 그 밑에
-- 깔려야 할 GRANT 자체가 없는 상태였던 것.
--
-- RLS는 이미 각 테이블의 정확한 CRUD 범위를 정책으로 표현해뒀으므로, 여기서는
-- 그 정책들이 실제로 허용하는 연산과 동일한 범위로 GRANT만 맞춰 넣는다. RLS는
-- 정책이 없는 연산(예: homework_items의 insert/delete)은 GRANT 여부와 무관하게
-- 계속 막으므로 과도한 권한 노출이 되지는 않는다.
--
-- profiles는 예외: update는 0003에서 이미 컬럼 단위로만 내줬고(xp/coins/role 등은
-- 여전히 막힘), insert는 handle_new_user() 트리거(security definer)가 대신하므로
-- 의도적으로 select만 추가한다.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

-- profiles: select만. update는 0003의 컬럼 단위 grant를 그대로 따른다.
grant select on public.profiles to authenticated;

-- 공개 참조 테이블 (정책이 using (true))
grant select on public.subjects, public.units, public.badges to anon, authenticated;

-- questions: 정책이 authenticated 롤만 허용
grant select on public.questions to authenticated;

-- 소유자 기반 select/insert/update/delete 정책이 모두 있는 테이블들
grant select, insert, update, delete on
  public.diagnostic_results,
  public.user_subject_stats,
  public.unit_mastery,
  public.homeworks,
  public.study_plans,
  public.study_sessions,
  public.wrong_answers,
  public.daily_feedback,
  public.user_badges,
  public.xp_transactions,
  public.notifications,
  public.discord_links,
  public.study_plan_items
to authenticated;

-- settings: select/insert(upsert)/update 정책만 있음 (delete 정책 없음)
grant select, insert, update on public.settings to authenticated;

-- homework_items: select/update 정책만 있음 (insert/delete는 서버가 service_role로 생성)
grant select, update on public.homework_items to authenticated;
