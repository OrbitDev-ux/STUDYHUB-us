-- 학년별 문제은행 풀이 기록. 정답과 XP 판정은 서버 액션을 거쳐 이 RPC에서 원자적으로 처리한다.
create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,
  grade_level text not null,
  subject_id text not null references public.subjects(id),
  unit_name text not null,
  user_answer text not null,
  is_correct boolean not null,
  xp_awarded boolean not null default false,
  attempted_at timestamptz not null default now(),
  constraint practice_grade_valid check (grade_level in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')),
  constraint practice_subject_valid check (subject_id in ('math','english','social','science'))
);

create index if not exists practice_attempts_user_recent
  on public.practice_attempts (user_id, attempted_at desc);
create index if not exists practice_attempts_user_question
  on public.practice_attempts (user_id, question_key) where is_correct;

alter table public.practice_attempts enable row level security;

drop policy if exists "practice_attempts_select_own" on public.practice_attempts;
create policy "practice_attempts_select_own" on public.practice_attempts for select
  using (auth.uid() = user_id);

-- 클라이언트의 직접 insert를 허용하지 않는다. 서버가 정답을 다시 확인한 후 RPC를 호출한다.
create or replace function public.record_practice_attempt(
  p_question_key text,
  p_grade_level text,
  p_subject_id text,
  p_unit_name text,
  p_user_answer text,
  p_is_correct boolean
)
returns table(attempt_id uuid, reward_granted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_attempt_id uuid;
  v_reward boolean := false;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if length(p_question_key) > 100 or length(p_user_answer) > 500
     or p_grade_level not in ('초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3')
     or p_subject_id not in ('math','english','social','science')
     or p_question_key !~ ('^' || p_grade_level || ':' || p_subject_id || ':([0-9]|1[0-5])$') then
    raise exception 'invalid practice attempt';
  end if;

  -- 같은 사용자/문제의 동시 제출도 최초 정답 보상이 한 번만 지급되도록 잠근다.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_question_key, 0));
  if p_is_correct then
    select not exists (
      select 1 from public.practice_attempts
      where user_id = v_user and question_key = p_question_key and is_correct
    ) into v_reward;
  end if;

  insert into public.practice_attempts (
    user_id, question_key, grade_level, subject_id, unit_name,
    user_answer, is_correct, xp_awarded
  ) values (
    v_user, p_question_key, p_grade_level, p_subject_id, p_unit_name,
    p_user_answer, p_is_correct, v_reward
  ) returning id into v_attempt_id;

  if v_reward then
    perform * from public.award_xp(2, '문제은행 최초 정답');
  end if;

  return query select v_attempt_id, v_reward;
end;
$$;

grant execute on function public.record_practice_attempt(text, text, text, text, text, boolean) to authenticated;
notify pgrst, 'reload schema';
