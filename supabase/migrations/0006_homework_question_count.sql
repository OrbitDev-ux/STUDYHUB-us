-- ---------------------------------------------------------------------------
-- 숙제 문제 수를 사용자가 직접 조절할 수 있게 settings에 컬럼 추가.
-- (진단평가 문항 수는 DB 설정이 아니라 세션마다 20~30 사이에서 무작위로 정해지므로
--  별도 컬럼이 필요 없다 — app/onboarding/actions.ts에서 직접 난수를 뽑는다.)
-- ---------------------------------------------------------------------------

alter table public.settings
  add column homework_question_count integer not null default 10
  check (homework_question_count between 5 and 30);
