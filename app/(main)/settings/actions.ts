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

  await supabase
    .from("settings")
    .update({ homework_time, notification_enabled, pomodoro_focus_min, pomodoro_break_min })
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
