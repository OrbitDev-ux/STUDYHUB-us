"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { DISCORD_OAUTH_STATE_COOKIE } from "@/lib/discord/oauth";
import { notifyMaintenanceModeChange } from "@/lib/discord/webhook";
import { planLimits, isPlan } from "@/lib/plan";
import { getUserPlan, isMissingColumnError } from "@/lib/supabase/compat";

/** 로그인 사용자를 요구하는 서버 액션들의 공통 진입부 — 없으면 로그인 페이지로 보낸다. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

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
 * 이메일로 사용자를 찾아 닉네임/현재 플랜을 반환한다 (관리자 전용).
 * service_role로 auth.users를 조회해야 하므로, DB RPC의 보호를 받지 못하는 이
 * 함수 자체에서 admin 여부를 직접 검증한다 (다른 관리자 액션과 달리 RPC를 거치지 않음).
 */
export async function findUserByEmail(
  email: string
): Promise<{ id: string; nickname: string; plan: string; email: string } | null> {
  const { supabase, user } = await requireUser();

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;

  const admin = createAdminClient();
  // Admin Auth API에 이메일 직접 필터가 없어 페이지를 넘기며 직접 매칭한다.
  // (유저 수가 훨씬 많아지면 profiles에 email 컬럼을 추가하는 방식으로 바꿔야 한다.)
  const perPage = 1000;
  let authUser: { id: string; email?: string } | undefined;
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage });
    authUser = data?.users.find((u) => u.email?.toLowerCase() === trimmed);
    if (authUser || !data || data.users.length < perPage) break;
  }
  if (!authUser) return null;

  const [{ data: profile, error: profileError }, currentPlan] = await Promise.all([
    admin.from("profiles").select("nickname").eq("id", authUser.id).single(),
    getUserPlan(admin, authUser.id),
  ]);
  if (profileError) throw new Error(`사용자 프로필 조회 실패: ${profileError.message}`);
  if (!profile) return null;

  return { id: authUser.id, nickname: profile.nickname, plan: currentPlan, email: authUser.email ?? "" };
}

/** 특정 유저의 플랜 변경 (관리자 전용). DB의 set_user_plan()이 관리자 권한을 다시 검증한다. */
export async function setUserPlan(targetUserId: string, plan: string) {
  const { supabase } = await requireUser();

  if (!isPlan(plan)) throw new Error("잘못된 플랜입니다.");

  const { error } = await supabase.rpc("set_user_plan", { p_target_user_id: targetUserId, p_plan: plan });
  if (error) throw new Error(`플랜 변경 실패: ${error.message}`);

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
  // auth.users 삭제는 DB 행을 cascade하지만 Storage 객체는 자동으로 없어지지 않는다.
  // 회원 탈퇴 전에 본인 폴더의 프로필 이미지를 함께 정리한다.
  const { data: mediaFiles, error: mediaListError } = await admin.storage.from("profile-media").list(user.id, { limit: 100 });
  if (!mediaListError && mediaFiles?.length) {
    const { error: mediaDeleteError } = await admin.storage
      .from("profile-media")
      .remove(mediaFiles.map((file) => `${user.id}/${file.name}`));
    if (mediaDeleteError) console.error("[account-delete] 프로필 이미지 삭제 실패:", mediaDeleteError.message);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`계정 삭제 실패: ${error.message}`);

  await supabase.auth.signOut();
  redirect("/");
}

/**
 * 점검 모드 on/off. DB의 set_maintenance_mode()가 관리자 권한을 다시 검증하므로
 * 여기서는 별도 권한 체크 없이 그대로 위임한다 (UI는 관리자에게만 노출됨).
 */
export async function setMaintenanceMode(formData: FormData) {
  const { supabase } = await requireUser();

  const enabled = formData.get("enabled") === "on";
  const message = String(formData.get("message") ?? "").trim() || null;

  const { error } = await supabase.rpc("set_maintenance_mode", { p_enabled: enabled, p_message: message });
  if (error) throw new Error(`점검 모드 변경 실패: ${error.message}`);

  await notifyMaintenanceModeChange(enabled, message);

  revalidatePath("/settings");
}
