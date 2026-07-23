"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { generateDiagnosticQuestions, analyzeDiagnosticResult } from "@/lib/ai/diagnostic";
import type { SubjectId } from "@/types";

const GRADE_LEVELS = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];

export async function saveOnboardingInfo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nickname = String(formData.get("nickname") ?? "").trim();
  const grade_level = String(formData.get("grade_level") ?? "");
  const target_study_minutes = Number(formData.get("target_study_minutes") ?? 60);
  const target_score = String(formData.get("target_score") ?? "");
  const exam_date = String(formData.get("exam_date") ?? "") || null;

  const validExamDate = exam_date === null || /^\d{4}-\d{2}-\d{2}$/.test(exam_date);
  if (
    !nickname ||
    nickname.length > 20 ||
    !GRADE_LEVELS.includes(grade_level) ||
    !Number.isFinite(target_study_minutes) ||
    target_study_minutes < 10 ||
    target_study_minutes > 600 ||
    !validExamDate
  ) {
    redirect("/onboarding?error=invalid_input");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nickname, grade_level, target_study_minutes, target_score, exam_date })
    .eq("id", user.id);

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/onboarding/diagnostic");
}

const SUBJECT_ORDER: SubjectId[] = ["math", "english", "social", "science"];

function isSubjectId(value: string): value is SubjectId {
  return SUBJECT_ORDER.includes(value as SubjectId);
}

/** 진단평가 문항 세트를 생성해서 클라이언트에 반환 (풀이는 클라이언트 상태로, 제출 시에만 DB 기록) */
export async function fetchDiagnosticQuestions(subject: SubjectId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSubjectId(subject)) throw new Error("지원하지 않는 과목입니다.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("grade_level,onboarding_completed")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(`프로필 조회 실패: ${profileError.message}`);
  if (profile.onboarding_completed) redirect("/dashboard");
  if (!profile.grade_level) redirect("/onboarding");

  // 과목마다 20~30문제 사이에서 무작위로 문항 수를 정한다.
  const questionCount = 20 + Math.floor(Math.random() * 11);
  const questions = await generateDiagnosticQuestions(subject, profile.grade_level, questionCount);
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("진단평가 문항을 생성하지 못했습니다.");
  }
  return questions;
}

interface SubmitPayload {
  subject: SubjectId;
  answered: { content: string; unit_name: string; correct: boolean; difficulty: number }[];
}

/** 채점 결과 제출 → AI 분석 → diagnostic_results 저장 → user_subject_stats 갱신 */
export async function submitDiagnosticResult({ subject, answered }: SubmitPayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSubjectId(subject) || !Array.isArray(answered) || answered.length === 0) {
    throw new Error("유효하지 않은 진단평가 결과입니다.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("grade_level,onboarding_completed")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(`프로필 조회 실패: ${profileError.message}`);
  if (profile.onboarding_completed) redirect("/dashboard");
  if (!profile.grade_level) redirect("/onboarding");

  const analysis = await analyzeDiagnosticResult(subject, profile.grade_level, answered);

  const { error: diagnosticError } = await supabase.from("diagnostic_results").insert({
    user_id: user.id,
    subject_id: subject,
    score: analysis.score,
    predicted_grade: analysis.predicted_grade,
    percentile_band: analysis.percentile_band,
    strong_units: analysis.strong_units,
    weak_units: analysis.weak_units,
    ai_summary: analysis.ai_summary,
    raw_answers: answered,
  });
  if (diagnosticError) throw new Error(`진단 결과 저장 실패: ${diagnosticError.message}`);

  const { error: statsError } = await supabase.from("user_subject_stats").upsert(
    {
      user_id: user.id,
      subject_id: subject,
      current_grade: analysis.predicted_grade,
      current_percentile_band: analysis.percentile_band,
      mastery_score: analysis.score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,subject_id" }
  );
  if (statsError) throw new Error(`과목 통계 저장 실패: ${statsError.message}`);

  const currentIndex = SUBJECT_ORDER.indexOf(subject);
  const nextSubject = SUBJECT_ORDER[currentIndex + 1];

  if (nextSubject) {
    return { done: false, nextSubject, analysis };
  }

  const { error: completionError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  if (completionError) throw new Error(`온보딩 완료 처리 실패: ${completionError.message}`);
  return { done: true, nextSubject: null, analysis };
}
