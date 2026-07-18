"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { awardXP, bumpStreak } from "@/lib/gamification/xp";
import type { SubjectId } from "@/types";

// 한 세션(타이머 종료 1회 호출)에서 인정하는 최대 시간. Server Action은 인증만 되어 있으면
// 누구나 직접 호출할 수 있는 공개 엔드포인트이므로, 클라이언트가 보낸 값을 그대로 믿고
// XP를 지급하면 위조된 값으로 무제한 XP 획득이 가능하다.
const MAX_SESSION_MINUTES = 240;

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

  const focusMinutes = Math.min(
    Math.max(0, Math.round(Number.isFinite(input.focusMinutes) ? input.focusMinutes : 0)),
    MAX_SESSION_MINUTES
  );
  const breakMinutes = Math.min(
    Math.max(0, Math.round(Number.isFinite(input.breakMinutes) ? input.breakMinutes : 0)),
    MAX_SESSION_MINUTES
  );

  const now = new Date();
  const startedAt = new Date(now.getTime() - focusMinutes * 60000).toISOString();

  await supabase.from("study_sessions").insert({
    user_id: user.id,
    subject_id: input.subjectId,
    mode: input.mode,
    started_at: startedAt,
    ended_at: now.toISOString(),
    focus_minutes: focusMinutes,
    break_minutes: breakMinutes,
    interrupted: input.interrupted,
  });

  // 연속 학습일 갱신 (원자적 RPC - 동시 세션 저장 시 레이스 컨디션 방지)
  await bumpStreak(supabase);

  // XP 지급 (원자적 RPC - xp_transactions 기록 및 레벨 재계산 포함)
  if (focusMinutes > 0) {
    await awardXP(supabase, Math.round(focusMinutes / 5) * 2, "타이머 학습 완료");
  }

  revalidatePath("/dashboard");
  revalidatePath("/timer");
}
