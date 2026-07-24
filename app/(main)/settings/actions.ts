"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { DISCORD_OAUTH_STATE_COOKIE, getDiscordOAuthRedirectUri } from "@/lib/discord/oauth";
import { notifyMaintenanceModeChange } from "@/lib/discord/webhook";
import { planLimits, isPlan } from "@/lib/plan";
import { getUserPlan, isMissingColumnError } from "@/lib/supabase/compat";
import { isDeveloperRole } from "@/lib/developer/roles";
import { sendDiscordDM } from "@/lib/discord/bot";
import { removeDiscordRatingRoles } from "@/lib/discord/rating-role";

export interface AccountActionState {
  status: "idle" | "success" | "error";
  message: string;
}

export interface DiscordLinkCodeState {
  status: "idle" | "success" | "error";
  message: string;
  code?: string;
  expiresAt?: string;
}

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

/** 로그인된 사용자가 설정 화면에서 비밀번호를 변경한다. */
export async function changePassword(
  _previous: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const { supabase } = await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");
  if (password.length < 8 || password.length > 72) {
    return { status: "error", message: "비밀번호는 8~72자로 입력해주세요." };
  }
  if (password !== confirmation) {
    return { status: "error", message: "비밀번호 확인이 일치하지 않습니다." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: `비밀번호 변경 실패: ${error.message}` };
  return { status: "success", message: "비밀번호가 안전하게 변경되었습니다." };
}

/** 현재 브라우저를 제외한 다른 기기의 refresh token을 무효화한다. */
export async function signOutOtherSessions(): Promise<AccountActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { status: "error", message: `다른 기기 로그아웃 실패: ${error.message}` };
  return { status: "success", message: "다른 기기의 로그인 세션을 모두 종료했습니다." };
}

/** Discord OAuth 연동 시작 (Supabase의 identity linking이 아닌, 별도 Discord 봇 연동용 OAuth) */
export async function startDiscordLink() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) redirect("/settings?error=discord_config_missing");

  let redirectUri: string;
  try {
    redirectUri = getDiscordOAuthRedirectUri();
  } catch (error) {
    console.error("[discord/oauth] Invalid redirect URI configuration:", error);
    redirect("/settings?error=discord_config_invalid");
  }

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

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);
  redirect(authorizeUrl.toString());
}

export async function unlinkDiscord() {
  const { supabase, user } = await requireUser();

  const { data: link } = await supabase.from("discord_links")
    .select("discord_user_id").eq("user_id", user.id).maybeSingle();
  if (link?.discord_user_id) {
    await removeDiscordRatingRoles(link.discord_user_id).catch(() => false);
  }
  const { error } = await supabase.from("discord_links").delete().eq("user_id", user.id);
  if (error) throw new Error(`Discord 연동 해제 실패: ${error.message}`);
  revalidatePath("/settings");
}

export async function sendDiscordBotTest() {
  const { supabase, user } = await requireUser();
  const { data: link } = await supabase.from("discord_links")
    .select("discord_user_id").eq("user_id", user.id).maybeSingle();
  if (!link?.discord_user_id) redirect("/settings?discord=test_not_linked");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const delivered = await sendDiscordDM(
    link.discord_user_id,
    `✅ StudyHub Bot 연결 테스트에 성공했습니다.${siteUrl ? `\n${siteUrl}/dashboard` : ""}`,
  );
  redirect(`/settings?discord=${delivered ? "test_sent" : "test_failed"}`);
}

const DISCORD_LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newDiscordLinkCode() {
  return [...randomBytes(8)]
    .map((byte) => DISCORD_LINK_CODE_ALPHABET[byte % DISCORD_LINK_CODE_ALPHABET.length])
    .join("");
}

export async function generateDiscordLinkCode(
  _previous: DiscordLinkCodeState,
  _formData: FormData,
): Promise<DiscordLinkCodeState> {
  const { supabase } = await requireUser();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newDiscordLinkCode();
    const codeHash = createHash("sha256").update(code).digest("hex");
    const { data, error } = await supabase.rpc("create_discord_link_code", {
      p_code_hash: codeHash,
    });
    if (!error) {
      return {
        status: "success",
        message: "Discord에서 10분 안에 아래 명령을 실행하세요.",
        code,
        expiresAt: String(data),
      };
    }
    if (/schema cache|could not find|does not exist/i.test(error.message)) {
      return { status: "error", message: "코드 연동 DB 업데이트가 필요합니다. 관리자에게 문의해주세요." };
    }
    if (/banned user/i.test(error.message)) {
      return { status: "error", message: "이용 정지된 계정은 Discord를 연결할 수 없습니다." };
    }
    if (error.code !== "23505") {
      return { status: "error", message: `연동 코드 생성 실패: ${error.message}` };
    }
  }
  return { status: "error", message: "안전한 코드를 만들지 못했습니다. 잠시 후 다시 시도해주세요." };
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
  if (!isDeveloperRole(caller?.role)) throw new Error("관리자만 사용할 수 있습니다.");

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
