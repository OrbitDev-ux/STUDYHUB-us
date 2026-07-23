"use server";

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { generatePracticeSet, isGradeLevel } from "@/lib/practice/question-bank";
import { resolvePracticeQuestion, resolvePracticeQuestions } from "@/lib/practice/question-resolver";
import type { SubjectId } from "@/types";
import { isDeveloperRole } from "@/lib/developer/roles";

const SUBJECTS: SubjectId[] = ["math", "english", "social", "science"];

export type ContestStanding = {
  user_id: string; nickname: string; avatar_url: string | null; rating: number;
  score: number; solved: number; penalty_seconds: number; finished_at: string | null;
  final_rank: number | null; rating_before: number | null; rating_after: number | null; rating_change: number | null;
};
export type ContestState = {
  id: string; title: string; description: string; gradeLevel: string; subjectId: SubjectId;
  startsAt: string; endsAt: string; phase: "scheduled" | "active" | "finished";
  questions: { key: string; unitName: string; difficulty: number; content: string; choices: string[] }[];
  answeredKeys: string[]; score: number; solved: number; standings: ContestStanding[]; canParticipate: boolean;
};

export async function createContest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isDeveloperRole(profile?.role)) throw new Error("관리자만 대회를 만들 수 있습니다.");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const grade = String(formData.get("grade_level") ?? "");
  const subject = String(formData.get("subject_id") ?? "") as SubjectId;
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const duration = Math.min(240, Math.max(10, Number(formData.get("duration_minutes") ?? 60)));
  const startsAt = new Date(`${startsAtRaw}:00+09:00`);
  if (title.length < 2 || title.length > 100 || description.length > 2000 || !isGradeLevel(grade) || !SUBJECTS.includes(subject) || Number.isNaN(startsAt.getTime())) {
    throw new Error("대회 입력값을 확인해주세요.");
  }
  const keys = generatePracticeSet(grade, subject).map((question) => question.key);
  for (let index = keys.length - 1; index > 0; index--) {
    const other = randomInt(index + 1); [keys[index], keys[other]] = [keys[other]!, keys[index]!];
  }
  const { data, error } = await createAdminClient().from("contests").insert({
    title, description, grade_level: grade, subject_id: subject, question_keys: keys.slice(0, 10),
    starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + duration * 60000).toISOString(), created_by: user.id,
  }).select("id").single();
  if (error || !data) throw new Error(`대회 생성 실패: ${error?.message ?? "unknown"}`);
  redirect(`/contests/${data.id}`);
}

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
    supabase.from("contest_entries").select("score, solved").eq("contest_id", contestId).eq("user_id", user.id).maybeSingle(),
    supabase.rpc("get_contest_leaderboard", { p_contest_id: contestId, p_limit: 100 }) as unknown as Promise<{ data: ContestStanding[] | null }>,
  ]);
  const keys = Array.isArray(contest.question_keys) ? contest.question_keys as string[] : [];
  const resolvedQuestions = phase === "scheduled" ? [] : await resolvePracticeQuestions(keys);
  const questions = resolvedQuestions.map((question) => ({
    key: question.key, unitName: question.unitName, difficulty: question.difficulty, content: question.content, choices: question.choices,
  }));
  return { state: {
    id: contest.id, title: contest.title, description: contest.description, gradeLevel: contest.grade_level,
    subjectId: contest.subject_id, startsAt: contest.starts_at, endsAt: contest.ends_at, phase, questions,
    answeredKeys: (answers ?? []).map((answer) => answer.question_key), score: entry?.score ?? 0, solved: entry?.solved ?? 0,
    standings: standings ?? [], canParticipate: profile?.grade_level === contest.grade_level,
  } };
}

export async function submitContestAnswer(contestId: string, questionKey: string, userAnswer: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const question = await resolvePracticeQuestion(questionKey);
  if (!question || !userAnswer || userAnswer.length > 500) return { error: "올바르지 않은 답안입니다." };
  const { data: contest } = await supabase.from("contests").select("question_keys, starts_at, ends_at").eq("id", contestId).single();
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
