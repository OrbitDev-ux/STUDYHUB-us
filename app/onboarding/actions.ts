"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { generateDiagnosticQuestions, analyzeDiagnosticResult } from "@/lib/ai/diagnostic";
import type { SubjectId } from "@/types";

export async function saveOnboardingInfo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nickname = String(formData.get("nickname") ?? "");
  const grade_level = String(formData.get("grade_level") ?? "");
  const target_study_minutes = Number(formData.get("target_study_minutes") ?? 60);
  const target_score = String(formData.get("target_score") ?? "");
  const exam_date = String(formData.get("exam_date") ?? "") || null;

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

/** 진단평가 문항 세트를 생성해서 클라이언트에 반환 (풀이는 클라이언트 상태로, 제출 시에만 DB 기록) */
export async function fetchDiagnosticQuestions(subject: SubjectId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade_level")
    .eq("id", user.id)
    .single();

  const questions = await generateDiagnosticQuestions(subject, profile?.grade_level ?? "중2");
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade_level")
    .eq("id", user.id)
    .single();

  const analysis = await analyzeDiagnosticResult(subject, profile?.grade_level ?? "중2", answered);

  await supabase.from("diagnostic_results").insert({
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

  await supabase.from("user_subject_stats").upsert(
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

  const currentIndex = SUBJECT_ORDER.indexOf(subject);
  const nextSubject = SUBJECT_ORDER[currentIndex + 1];

  if (nextSubject) {
    return { done: false, nextSubject, analysis };
  }

  await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  return { done: true, nextSubject: null, analysis };
}
