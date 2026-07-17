"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateDailyFeedback } from "@/lib/ai/feedback";

export async function ensureTodayFeedback() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("daily_feedback")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) return existing;

  const [{ data: profile }, { data: sessions }, { data: homework }, { data: diagnostics }] = await Promise.all([
    supabase.from("profiles").select("nickname, target_study_minutes, streak_days").eq("id", user.id).single(),
    supabase.from("study_sessions").select("focus_minutes").eq("user_id", user.id).gte("started_at", `${today}T00:00:00`),
    supabase
      .from("homeworks")
      .select("*, homework_items(is_correct)")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    supabase.from("diagnostic_results").select("subject_id, weak_units").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const studyMinutes = (sessions ?? []).reduce((s, x) => s + (x.focus_minutes ?? 0), 0);
  const items = homework?.homework_items ?? [];
  const answered = items.filter((i: { is_correct: boolean | null }) => i.is_correct !== null);
  const correct = items.filter((i: { is_correct: boolean | null }) => i.is_correct === true);
  const completionRate = items.length ? Math.round((answered.length / items.length) * 100) : 0;
  const correctRate = answered.length ? Math.round((correct.length / answered.length) * 100) : 0;

  const weakUnits = new Set<string>();
  for (const d of diagnostics ?? []) {
    for (const u of (d.weak_units as { name: string }[]) ?? []) weakUnits.add(u.name);
  }

  if (studyMinutes === 0 && items.length === 0) {
    return null; // 아직 오늘 활동이 없으면 피드백 생성 안 함
  }

  const generated = await generateDailyFeedback({
    nickname: profile?.nickname ?? "학생",
    studyMinutes,
    targetMinutes: profile?.target_study_minutes ?? 60,
    homeworkCompletionRate: completionRate,
    correctRate,
    improvedUnits: [],
    weakUnits: [...weakUnits],
    streakDays: profile?.streak_days ?? 0,
  });

  const { data: feedback } = await supabase
    .from("daily_feedback")
    .insert({
      user_id: user.id,
      date: today,
      study_minutes: studyMinutes,
      goal_achievement_rate: generated.goal_achievement_rate,
      improved_units: [],
      recommended_next: generated.recommended_next,
      ai_message: generated.ai_message,
    })
    .select("*")
    .single();

  revalidatePath("/report");
  return feedback;
}
