"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { DISCORD_OAUTH_STATE_COOKIE } from "@/lib/discord/oauth";
import { planLimits } from "@/lib/plan";
import { getUserPlan, isMissingColumnError } from "@/lib/supabase/compat";
import { requireUser } from "@/lib/auth/require-user";

function boundedInteger(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

export async function updateSettings(formData: FormData) {
  const { supabase, user } = await requireUser();

  const currentPlan = await getUserPlan(supabase, user.id);
  const maxQuestions = planLimits(currentPlan).homeworkQuestionMax;

  const requestedHomeworkTime = String(formData.get("homework_time") ?? "07:00");
  const homework_time = /^([01]\d|2[0-3]):[0-5]\d$/.test(requestedHomeworkTime) ? requestedHomeworkTime : "07:00";
  const notification_enabled = formData.get("notification_enabled") === "on";
  const pomodoro_focus_min = boundedInteger(formData.get("pomodoro_focus_min"), 25, 1, 240);
  const pomodoro_break_min = boundedInteger(formData.get("pomodoro_break_min"), 5, 1, 60);
  // DB 체크 제약(5~30)을 벗어나면 UPDATE 전체가 거부되어 다른 필드까지 저장되지 않으므로 미리 clamp.
  // 플랜 상한도 함께 적용 (예: free는 10문제까지만).
  const homework_question_count = boundedInteger(formData.get("homework_question_count"), 10, 5, maxQuestions);

  const baseSettings = { homework_time, notification_enabled, pomodoro_focus_min, pomodoro_break_min };
  const { error } = await supabase
    .from("settings")
    .update({ ...baseSettings, homework_question_count })
    .eq("user_id", user.id);

  // 구버전 DB에서는 새 컬럼만 제외하고 나머지 설정은 정상 저장한다.
  if (isMissingColumnError(error)) {
    const { error: fallbackError } = await supabase.from("settings").update(baseSettings).eq("user_id", user.id);
    if (fallbackError) throw new Error(`설정 저장 실패: ${fallbackError.message}`);
  } else if (error) {
    throw new Error(`설정 저장 실패: ${error.message}`);
  }

  revalidatePath("/settings");
}

/** Discord OAuth 연동 시작 (Supabase의 identity linking이 아닌, 별도 Discord 봇 연동용 OAuth) */
export async function startDiscordLink() {
  await requireUser();

  const requestHeaders = await headers();
  const origin = (requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("Discord OAuth 설정이 누락되었습니다.");
  const redirectUri = encodeURIComponent(`${origin}/api/discord/callback`);

  // OAuth 로그인 CSRF 방지용 state. 콜백에서 쿠키 값과 대조해 검증한다.
  // (state 없이는 공격자가 자기 Discord 계정으로 받은 code를 피해자에게 콜백 URL로
  // 열게 만들어 피해자 계정에 공격자의 Discord를 연동시킬 수 있다.)
  const state = randomBytes(24).toString("hex");
  (await cookies()).set(DISCORD_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`;
  redirect(url);
}

export async function unlinkDiscord() {
  const { supabase, user } = await requireUser();

  await supabase.from("discord_links").delete().eq("user_id", user.id);
  revalidatePath("/settings");
}

/**
 * 계정 완전 삭제 (회원 탈퇴). auth.users 행을 지우면 모든 사용자 소유 테이블이
 * on delete cascade로 함께 삭제된다 (profiles, homeworks, study_sessions,
 * notifications 등 — 0001 마이그레이션 참고).
 */
export async function deleteAccount() {
  const { supabase, user } = await requireUser();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`계정 삭제 실패: ${error.message}`);

  await supabase.auth.signOut();
  redirect("/");
}
