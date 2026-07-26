-- ---------------------------------------------------------------------------
-- service_role에 대한 테이블 단위 base GRANT 복구.
--
-- 문제: 0037은 anon/authenticated의 누락된 base GRANT는 복구했지만 service_role은
-- 다루지 않았다. service_role은 RLS를 우회(bypassrls)하지만, RLS 우회와 테이블
-- 단위 GRANT/REVOKE는 완전히 별개의 권한 레이어라서 GRANT가 없으면 RLS와 무관하게
-- "permission denied for table ..."가 난다. 실제로 이 프로젝트의 테이블 대부분(초기
-- 0001부터 0033까지 생성된 모든 테이블)은 service_role에 SELECT/INSERT/UPDATE/DELETE
-- 권한이 전혀 부여돼 있지 않았다 — 0034/0035의 Discord 봇 테이블 3개만 예외적으로
-- 명시 GRANT가 있었는데, 그것도 각 마이그레이션에서 개별적으로 챙긴 결과일 뿐 프로젝트
-- 전반의 근본 원인은 그대로였다.
--
-- 영향: createAdminClient()(service_role)를 쓰는 모든 서버 전용 경로 — AI 숙제/문제
-- 생성, 대회 채점, 배지·XP 지급, 크론 작업, 온라인 저지 채점 등 — 가 이 GRANT 없이
-- 새로 프로비저닝된 프로젝트(로컬 CLI 신규 프로젝트 포함)에서는 전부 실패한다.
--
-- 해결: service_role은 RLS를 이미 우회하는 신뢰된 서버 전용 역할이므로, anon/
-- authenticated처럼 정책별로 세밀하게 맞출 필요 없이 public 스키마 전체에 대해
-- 포괄적으로 권한을 부여한다. 그리고 이후 새로 만들어지는 테이블에도 이 GRANT가
-- 자동으로 이어지도록 ALTER DEFAULT PRIVILEGES를 함께 설정해 같은 문제가 다시
-- 재발하지 않게 한다.
-- ---------------------------------------------------------------------------

grant usage on schema public to service_role;

do $$
declare
  tbl record;
begin
  for tbl in select tablename from pg_tables where schemaname = 'public' loop
    execute format('grant select, insert, update, delete on public.%I to service_role', tbl.tablename);
  end loop;
end;
$$;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
