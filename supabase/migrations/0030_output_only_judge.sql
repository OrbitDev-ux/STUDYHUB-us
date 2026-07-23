-- Convert the sandbox code-submission judge into a fixed-input/output-answer judge.
-- No source-code field is presented to users; only the final output is stored.

alter table public.oj_submissions
  add column if not exists submitted_output text,
  add column if not exists submission_mode text;

update public.oj_submissions
set submission_mode = case when source_code is null then 'output_only' else 'legacy_code' end
where submission_mode is null;

alter table public.oj_submissions
  alter column submission_mode set default 'output_only',
  alter column submission_mode set not null,
  alter column language drop not null,
  alter column source_code drop not null;

alter table public.oj_submissions
  drop constraint if exists oj_submissions_language_check,
  drop constraint if exists oj_submissions_source_code_check,
  drop constraint if exists oj_submissions_submitted_output_check,
  drop constraint if exists oj_submissions_submission_mode_check;

alter table public.oj_submissions
  add constraint oj_submissions_language_check check (
    language is null or language in ('cpp','java','python','javascript')
  ),
  add constraint oj_submissions_source_code_check check (
    source_code is null or char_length(source_code) between 1 and 50000
  ),
  add constraint oj_submissions_submitted_output_check check (
    submitted_output is null or char_length(submitted_output) between 1 and 50000
  ),
  add constraint oj_submissions_submission_mode_check check (
    submission_mode in ('output_only','legacy_code')
  );

-- The new model has exactly one public fixed input per problem. Its expected
-- output remains protected because oj_test_cases has no authenticated RLS policy.
delete from public.oj_test_cases where order_index > 0;
update public.oj_test_cases
set hidden = false, points = 100
where order_index = 0;

notify pgrst, 'reload schema';
