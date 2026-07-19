"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const explicitOrigin = requestHeaders.get("origin");
  if (explicitOrigin) return explicitOrigin.replace(/\/$/, "");

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, "");

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function safeRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("redirect"), "/dashboard");

  if (!email || !password) {
    redirect("/login?error=missing_fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[login] Supabase signInWithPassword failed:", error.status, error.message);
    redirect("/login?error=invalid_credentials");
  }

  redirect(next);
}

export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();

  if (!email || !password || !nickname) {
    redirect("/signup?error=missing_fields");
  }
  if (password.length < 8) {
    redirect("/signup?error=weak_password");
  }

  if (nickname.length > 20) {
    redirect("/signup?error=invalid_nickname");
  }

  const origin = await getRequestOrigin();
  const supabase = await createClient();

  // 임시 운영 옵션: Supabase의 메일 발송/확인 과정을 거치지 않고 관리 API로
  // 확인 완료 사용자를 만든 뒤 즉시 로그인한다. 환경변수를 제거하거나 false로
  // 바꾸면 기존 이메일 인증 플로우로 즉시 복구된다.
  if (process.env.AUTH_EMAIL_CONFIRMATION_DISABLED === "true") {
    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nickname },
    });

    if (createError || !created.user) {
      console.error("[signup] Supabase admin createUser failed:", createError?.status, createError?.message);
      redirect("/signup?error=signup_failed");
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      console.error("[signup] Sign-in after auto-confirm failed:", signInError.status, signInError.message);
      await admin.auth.admin.deleteUser(created.user.id);
      redirect("/signup?error=signup_failed");
    }

    redirect("/onboarding");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
      emailRedirectTo: `${origin}/api/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    console.error("[signup] Supabase signUp failed:", error.status, error.message);
    const isRateLimited = error.status === 429 || error.code?.includes("rate_limit");
    redirect(`/signup?error=${isRateLimited ? "rate_limit" : "signup_failed"}`);
  }

  // Supabase의 이메일 확인 옵션이 꺼져 있으면 signUp 즉시 세션이 발급된다.
  // 이 경우 존재하지 않는 인증 메일을 기다리게 하지 않고 바로 온보딩으로 이동한다.
  if (data.session) redirect("/onboarding");

  redirect("/signup/check-email");
}

export async function signInWithOAuth(provider: "google" | "discord") {
  const origin = await getRequestOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/api/auth/callback?next=/onboarding`,
    },
  });

  if (error || !data.url) {
    console.error("[oauth] Supabase signInWithOAuth failed:", provider, error?.status, error?.message);
    redirect("/login?error=oauth_failed");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
