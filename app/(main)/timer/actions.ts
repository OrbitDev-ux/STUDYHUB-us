"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { awardXP, bumpStreak, checkAndAwardBadges } from "@/lib/gamification/xp";
import { notifyNewBadges } from "@/lib/notifications/create";
import type { SubjectId } from "@/types";
import { creditSessionDuration, MIN_SESSION_SECONDS } from "@/lib/timer/session";

// 한 세션(타이머 종료 1회 호출)에서 인정하는 최대 시간. Server Action은 인증만 되어 있으면
// 누구나 직접 호출할 수 있는 공개 엔드포인트이므로, 클라이언트가 보낸 값을 그대로 믿고
// XP를 지급하면 위조된 값으로 무제한 XP 획득이 가능하다.
const SUBJECT_IDS: SubjectId[] = ["math", "english", "social", "science"];

/** 서버 시각으로 실제 타이머 세션을 시작한다. 이후 종료 요청은 이 행의 경과 시간을 넘겨 저장할 수 없다. */
export async function beginStudySession(subjectId: SubjectId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!SUBJECT_IDS.includes(subjectId)) throw new Error("지원하지 않는 과목입니다.");

  // 이전 탭이 비정상 종료되며 남긴 열린 세션은 중단 상태로 닫는다.
  await supabase
    .from("study_sessions")
    .update({ ended_at: new Date().toISOString(), interrupted: true })
    .eq("user_id", user.id)
    .is("ended_at", null);

  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      mode: "pomodoro",
      started_at: new Date().toISOString(),
      focus_minutes: 0,
      break_minutes: 0,
      interrupted: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`타이머 시작 실패: ${error?.message ?? "unknown error"}`);
  return data.id as string;
}

export async function saveStudySession(input: {
  sessionId: string;
  focusMinutes: number;
  breakMinutes: number;
  interrupted: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: openSession } = await supabase
    .from("study_sessions")
    .select("id, started_at, ended_at")
    .eq("id", input.sessionId)
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();
  if (!openSession) throw new Error("이미 저장됐거나 유효하지 않은 학습 세션입니다.");

  const { elapsedSeconds, focusMinutes, breakMinutes } = creditSessionDuration({
    requestedFocusMinutes: input.focusMinutes,
    requestedBreakMinutes: input.breakMinutes,
    startedAtMs: new Date(openSession.started_at).getTime(),
  });
  if (elapsedSeconds < MIN_SESSION_SECONDS) throw new Error("30초 이상 학습한 세션만 저장할 수 있습니다.");

  // 빈 세션으로 streak/얼리버드 조건을 채우는 것을 막는다.
  if (focusMinutes < 1) throw new Error("1분 이상 학습한 세션만 저장할 수 있습니다.");

  const { error: completeError } = await supabase.rpc("complete_study_session", {
    p_session_id: input.sessionId,
    p_focus_minutes: focusMinutes,
    p_break_minutes: breakMinutes,
    p_interrupted: input.interrupted,
  });

  if (completeError?.code === "PGRST202") {
    // 0013 적용 전 DB를 위한 호환 경로. 최신 DB에서는 위 RPC가 기록·streak·XP를 원자 처리한다.
    const { data: savedSession, error: sessionError } = await supabase
      .from("study_sessions")
      .update({ ended_at: new Date().toISOString(), focus_minutes: focusMinutes, break_minutes: breakMinutes, interrupted: input.interrupted })
      .eq("id", input.sessionId)
      .eq("user_id", user.id)
      .is("ended_at", null)
      .select("id")
      .maybeSingle();
    if (sessionError || !savedSession) throw new Error(`학습 기록 저장 실패: ${sessionError?.message ?? "이미 저장된 세션입니다."}`);
    await bumpStreak(supabase);
    if (focusMinutes > 0) await awardXP(supabase, Math.round(focusMinutes / 5) * 2, "타이머 학습 완료");
  } else if (completeError) {
    throw new Error(`학습 기록 저장 실패: ${completeError.message}`);
  }

  // 연속학습일/얼리버드 배지 판정 (streak, study_sessions 갱신 직후)
  try {
    const newBadges = await checkAndAwardBadges(supabase);
    await notifyNewBadges(supabase, user.id, newBadges);
  } catch (error) {
    // 세션·XP는 이미 원자적으로 저장됐으므로 부가 알림 실패를 사용자 저장 실패로 오인시키지 않는다.
    console.error("[timer] 배지 알림 처리 실패:", error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/timer");
  revalidatePath("/", "layout");
}
