"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolvePracticeQuestion, resolvePracticeQuestions } from "@/lib/practice/question-resolver";
import type { SubjectId } from "@/types";
import { judgeOutputsMatch } from "@/lib/online-judge/output";

export type ContestStanding = {
  user_id: string; nickname: string; avatar_url: string | null; rating: number;
  score: number; solved: number; penalty_seconds: number; finished_at: string | null;
  final_rank: number | null; rating_before: number | null; rating_after: number | null; rating_change: number | null;
  participation_mode: "rated" | "unrated";
  has_submitted: boolean;
};
export type ContestState = {
  id: string; title: string; description: string; gradeLevel: string; subjectId: SubjectId;
  startsAt: string; endsAt: string; phase: "scheduled" | "active" | "finished";
  serverNow: string;
  contestMode: "quiz" | "output_judge";
  questions: { key: string; unitName: string; difficulty: number; content: string; choices: string[] }[];
  judgeProblems: {
    id: string; title: string; statement: string; inputDescription: string;
    outputDescription: string; constraints: string; difficulty: number; fixedInput: string;
  }[];
  answeredKeys: string[]; score: number; solved: number; standings: ContestStanding[];
  eligible: boolean; canParticipate: boolean; canRegister: boolean; ratedAvailable: boolean;
  registrationMode: "rated" | "unrated" | null;
};

export async function getContestState(contestId: string): Promise<{ state?: ContestState; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const [{ data: contest }, { data: profile }] = await Promise.all([
    supabase.from("contests").select("*").eq("id", contestId).single(),
    supabase.from("profiles").select("grade_level").eq("id", user.id).single(),
  ]);
  if (!contest) return { error: "대회를 찾을 수 없습니다." };
  const now = Date.now();
  const phase = now < new Date(contest.starts_at).getTime() ? "scheduled" : now > new Date(contest.ends_at).getTime() ? "finished" : "active";
  if (phase === "finished" && !contest.ratings_finalized_at) {
    await supabase.rpc("finalize_contest_ratings", { p_contest_id: contestId });
  }
  const [{ data: answers }, { data: entry }, { data: standings }] = await Promise.all([
    supabase.from("contest_answers").select("question_key").eq("contest_id", contestId).eq("user_id", user.id),
    supabase.from("contest_entries").select("score,solved,participation_mode").eq("contest_id", contestId).eq("user_id", user.id).maybeSingle(),
    supabase.rpc("get_contest_leaderboard", { p_contest_id: contestId, p_limit: 100 }) as unknown as Promise<{ data: ContestStanding[] | null }>,
  ]);
  const contestMode = contest.contest_mode === "output_judge" ? "output_judge" : "quiz";
  const keys = Array.isArray(contest.question_keys) ? contest.question_keys as string[] : [];
  const judgeProblemIds = Array.isArray(contest.judge_problem_ids) ? contest.judge_problem_ids as string[] : [];
  const eligible = profile?.grade_level === contest.grade_level;
  const registrationMode = entry?.participation_mode === "rated" || entry?.participation_mode === "unrated"
    ? entry.participation_mode
    : null;
  const canParticipate = eligible && registrationMode !== null;
  const resolvedQuestions = phase === "scheduled" || (phase === "active" && !canParticipate)
    ? []
    : await resolvePracticeQuestions(keys);
  const questions = resolvedQuestions.map((question) => ({
    key: question.key, unitName: question.unitName, difficulty: question.difficulty, content: question.content, choices: question.choices,
  }));
  let judgeProblems: ContestState["judgeProblems"] = [];
  if (contestMode === "output_judge" && phase !== "scheduled" && (canParticipate || phase === "finished")) {
    const admin = createAdminClient();
    const [{ data: problemRows }, { data: fixedCases }] = await Promise.all([
      admin.from("oj_problems")
        .select("id,title,statement,input_description,output_description,constraints_text,difficulty")
        .in("id", judgeProblemIds),
      admin.from("oj_test_cases")
        .select("problem_id,input").in("problem_id", judgeProblemIds).eq("order_index", 0),
    ]);
    const problemMap = new Map((problemRows ?? []).map((problem) => [problem.id, problem]));
    const inputMap = new Map((fixedCases ?? []).map((testCase) => [testCase.problem_id, testCase.input]));
    judgeProblems = judgeProblemIds.flatMap((problemId) => {
      const problem = problemMap.get(problemId);
      const fixedInput = inputMap.get(problemId);
      return problem && fixedInput !== undefined ? [{
        id: problem.id,
        title: problem.title,
        statement: problem.statement,
        inputDescription: problem.input_description,
        outputDescription: problem.output_description,
        constraints: problem.constraints_text,
        difficulty: problem.difficulty,
        fixedInput,
      }] : [];
    });
  }
  return { state: {
    id: contest.id, title: contest.title, description: contest.description, gradeLevel: contest.grade_level,
    subjectId: contest.subject_id, startsAt: contest.starts_at, endsAt: contest.ends_at, phase,
    serverNow: new Date().toISOString(), contestMode, questions, judgeProblems,
    answeredKeys: (answers ?? []).map((answer) => answer.question_key), score: entry?.score ?? 0, solved: entry?.solved ?? 0,
    standings: (standings ?? []).map((standing) => ({
      ...standing,
      participation_mode: standing.participation_mode === "unrated"
        ? "unrated"
        : contest.is_rated ? "rated" : "unrated",
      has_submitted: standing.has_submitted ?? true,
    })),
    eligible,
    canParticipate,
    canRegister: phase === "scheduled" && eligible,
    ratedAvailable: Boolean(contest.is_rated),
    registrationMode,
  } };
}

export async function registerForContest(
  contestId: string,
  participationMode: "rated" | "unrated",
): Promise<{ mode?: "rated" | "unrated"; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^[0-9a-f-]{36}$/i.test(contestId) || !["rated", "unrated"].includes(participationMode)) {
    return { error: "등록 정보를 확인해주세요." };
  }
  const { data, error } = await supabase.rpc("register_for_contest", {
    p_contest_id: contestId,
    p_participation_mode: participationMode,
  });
  if (error) {
    if (/registration closed/i.test(error.message)) return { error: "대회 등록이 마감되었습니다." };
    if (/grade mismatch/i.test(error.message)) return { error: "이 대회의 대상 학년과 프로필 학년이 다릅니다." };
    if (/rated participation unavailable/i.test(error.message)) return { error: "이 대회는 Unrated로만 등록할 수 있습니다." };
    if (/schema cache|could not find|does not exist/i.test(error.message)) return { error: "Register 기능 DB 업데이트가 필요합니다." };
    return { error: `대회 등록 실패: ${error.message}` };
  }
  revalidatePath("/contests");
  revalidatePath(`/contests/${contestId}`);
  return { mode: data === "rated" ? "rated" : "unrated" };
}

export async function unregisterFromContest(contestId: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^[0-9a-f-]{36}$/i.test(contestId)) return { error: "대회 정보를 확인해주세요." };
  const { error } = await supabase.rpc("unregister_from_contest", { p_contest_id: contestId });
  if (error) {
    if (/registration closed|already started/i.test(error.message)) return { error: "대회 시작 후에는 등록을 취소할 수 없습니다." };
    return { error: `등록 취소 실패: ${error.message}` };
  }
  revalidatePath("/contests");
  revalidatePath(`/contests/${contestId}`);
  return { ok: true };
}

export async function submitContestAnswer(contestId: string, questionKey: string, userAnswer: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const [{ data: contest }, { data: entry }, question] = await Promise.all([
    supabase.from("contests").select("question_keys,starts_at,ends_at").eq("id", contestId).single(),
    supabase.from("contest_entries").select("id").eq("contest_id", contestId).eq("user_id", user.id).maybeSingle(),
    resolvePracticeQuestion(questionKey),
  ]);
  if (!entry) return { error: "대회에 먼저 Register 해야 합니다." };
  if (!question || !userAnswer || userAnswer.length > 500) return { error: "올바르지 않은 답안입니다." };
  const keys = Array.isArray(contest?.question_keys) ? contest.question_keys as string[] : [];
  const now = Date.now();
  if (!contest || now < new Date(contest.starts_at).getTime() || now > new Date(contest.ends_at).getTime() || !keys.includes(questionKey)) return { error: "현재 제출할 수 없는 문제입니다." };
  const correct = userAnswer.trim() === question.answer;
  const { error } = await createAdminClient().rpc("record_contest_answer", {
    p_user_id: user.id, p_contest_id: contestId, p_question_key: questionKey,
    p_user_answer: userAnswer.trim(), p_is_correct: correct,
  });
  if (error) return { error: `제출 실패: ${error.message}` };
  return { correct, answer: question.answer, explanation: question.explanation };
}

export async function submitContestJudgeOutput(
  contestId: string,
  problemId: string,
  submittedOutput: string,
): Promise<{ verdict?: "accepted" | "wrong_answer"; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!/^[0-9a-f-]{36}$/i.test(contestId) || !/^[0-9a-f-]{36}$/i.test(problemId)
    || !submittedOutput.trim() || submittedOutput.length > 50_000) {
    return { error: "출력 답안을 확인해주세요." };
  }
  const [{ data: contest }, { data: entry }] = await Promise.all([
    supabase.from("contests")
      .select("contest_mode,judge_problem_ids,starts_at,ends_at")
      .eq("id", contestId).single(),
    supabase.from("contest_entries").select("id")
      .eq("contest_id", contestId).eq("user_id", user.id).maybeSingle(),
  ]);
  const problemIds = Array.isArray(contest?.judge_problem_ids) ? contest.judge_problem_ids as string[] : [];
  const now = Date.now();
  if (!entry || !contest || contest.contest_mode !== "output_judge"
    || !problemIds.includes(problemId)
    || now < new Date(contest.starts_at).getTime()
    || now > new Date(contest.ends_at).getTime()) {
    return { error: "현재 이 문제에 답안을 제출할 수 없습니다." };
  }
  const admin = createAdminClient();
  const { data: fixedCase } = await admin.from("oj_test_cases")
    .select("expected_output").eq("problem_id", problemId).eq("order_index", 0).single();
  if (!fixedCase) return { error: "서버 정답 데이터가 준비되지 않았습니다." };
  const accepted = judgeOutputsMatch(submittedOutput, fixedCase.expected_output);
  const { error } = await admin.rpc("record_contest_judge_output", {
    p_user_id: user.id,
    p_contest_id: contestId,
    p_problem_id: problemId,
    p_submitted_output: submittedOutput,
    p_is_correct: accepted,
  });
  if (error) {
    if (/already answered/i.test(error.message)) return { error: "이 문제에는 이미 답안을 제출했습니다." };
    if (/schema cache|could not find|does not exist/i.test(error.message)) return { error: "코딩 대회 DB 업데이트가 필요합니다." };
    return { error: `답안을 제출하지 못했습니다: ${error.message}` };
  }
  revalidatePath(`/contests/${contestId}`);
  return { verdict: accepted ? "accepted" : "wrong_answer" };
}
