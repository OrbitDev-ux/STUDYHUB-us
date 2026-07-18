"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { DISCORD_OAUTH_STATE_COOKIE } from "@/lib/discord/oauth";

export async function updateSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const homework_time = String(formData.get("homework_time") ?? "07:00");
  const notification_enabled = formData.get("notification_enabled") === "on";
  const pomodoro_focus_min = Number(formData.get("pomodoro_focus_min") ?? 25);
  const pomodoro_break_min = Number(formData.get("pomodoro_break_min") ?? 5);
  // DB 체크 제약(5~30)을 벗어나면 UPDATE 전체가 거부되어 다른 필드까지 저장되지 않으므로 미리 clamp.
  const homework_question_count = Math.min(30, Math.max(5, Number(formData.get("homework_question_count") ?? 10)));

  await supabase
    .from("settings")
    .update({ homework_time, notification_enabled, pomodoro_focus_min, pomodoro_break_min, homework_question_count })
    .eq("user_id", user.id);

  revalidatePath("/settings");
}

/** Discord OAuth 연동 시작 (Supabase의 identity linking이 아닌, 별도 Discord 봇 연동용 OAuth) */
export async function startDiscordLink() {
  const origin = (await headers()).get("origin");
  const clientId = process.env.DISCORD_CLIENT_ID;
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("discord_links").delete().eq("user_id", user.id);
  revalidatePath("/settings");
}

/**
 * 점검 모드 on/off. DB의 set_maintenance_mode()가 관리자 권한을 다시 검증하므로
 * 여기서는 별도 권한 체크 없이 그대로 위임한다 (UI는 관리자에게만 노출됨).
 */
export async function setMaintenanceMode(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const enabled = formData.get("enabled") === "on";
  const message = String(formData.get("message") ?? "").trim() || null;

  const { error } = await supabase.rpc("set_maintenance_mode", { p_enabled: enabled, p_message: message });
  if (error) throw new Error(`점검 모드 변경 실패: ${error.message}`);

  revalidatePath("/settings");
}
