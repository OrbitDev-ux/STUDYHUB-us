"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
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
