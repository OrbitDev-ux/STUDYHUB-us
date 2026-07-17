"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { awardXP, bumpStreak } from "@/lib/gamification/xp";
import type { SubjectId } from "@/types";

export async function saveStudySession(input: {
  subjectId: SubjectId | null;
  mode: "pomodoro" | "free";
  focusMinutes: number;
  breakMinutes: number;
  interrupted: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const startedAt = new Date(now.getTime() - input.focusMinutes * 60000).toISOString();

  await supabase.from("study_sessions").insert({
    user_id: user.id,
    subject_id: input.subjectId,
    mode: input.mode,
    started_at: startedAt,
    ended_at: now.toISOString(),
    focus_minutes: input.focusMinutes,
    break_minutes: input.breakMinutes,
    interrupted: input.interrupted,
  });

  // 연속 학습일 갱신 (원자적 RPC - 동시 세션 저장 시 레이스 컨디션 방지)
  await bumpStreak(supabase);

  // XP 지급 (원자적 RPC - xp_transactions 기록 및 레벨 재계산 포함)
  if (input.focusMinutes > 0) {
    await awardXP(supabase, Math.round(input.focusMinutes / 5) * 2, "타이머 학습 완료");
  }

  revalidatePath("/dashboard");
  revalidatePath("/timer");
}
