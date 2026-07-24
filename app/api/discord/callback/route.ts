import { createClient } from "@/lib/supabase/server";
import { DISCORD_OAUTH_STATE_COOKIE, getDiscordOAuthRedirectUri } from "@/lib/discord/oauth";
import { syncDiscordRatingRole } from "@/lib/discord/rating-role";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let redirectUri: string;
  try {
    redirectUri = getDiscordOAuthRedirectUri();
  } catch (error) {
    console.error("[discord/oauth] Invalid callback configuration:", error);
    return NextResponse.json(
      { error: "Discord OAuth Callback URL 설정이 올바르지 않습니다." },
      { status: 500 },
    );
  }
  const siteOrigin = new URL(redirectUri).origin;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(`${siteOrigin}/settings?error=discord_no_code`);
  }

  // OAuth 로그인 CSRF 방지: startDiscordLink에서 심어둔 쿠키와 state가 일치해야 진행한다.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DISCORD_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(DISCORD_OAUTH_STATE_COOKIE);
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${siteOrigin}/settings?error=discord_invalid_state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteOrigin}/login`);

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${siteOrigin}/settings?error=discord_config_missing`);
  }

  // 1) authorization code를 access token으로 교환
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[discord/oauth] Token exchange failed:", tokenRes.status, await tokenRes.text());
    return NextResponse.redirect(`${siteOrigin}/settings?error=discord_token_failed`);
  }
  const tokenData = await tokenRes.json();

  // 2) 액세스 토큰으로 Discord 유저 정보 조회
  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!meRes.ok) {
    return NextResponse.redirect(`${siteOrigin}/settings?error=discord_user_failed`);
  }
  const me = await meRes.json();

  // 3) 현재 플랜이 이미 Basic/Pro라면 연동 시점에 바로 프리미엄 플래그를 세운다
  //    (반대 방향 - 플랜 변경 시 기존 연동에 반영하는 것 - 은 set_user_plan()이 처리한다).
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const premiumRoleGranted = profile?.plan === "basic" || profile?.plan === "pro";

  // 4) discord_links 테이블에 upsert
  const { error: linkError } = await supabase.from("discord_links").upsert(
    {
      user_id: user.id,
      discord_user_id: me.id,
      discord_username: `${me.username}`,
      linked_at: new Date().toISOString(),
      premium_role_granted: premiumRoleGranted,
    },
    { onConflict: "user_id" }
  );
  if (linkError) {
    // 한 Discord 계정은 하나의 StudyHub 계정에만 연결할 수 있다.
    const reason = linkError.code === "23505" ? "discord_already_linked" : "discord_save_failed";
    return NextResponse.redirect(`${siteOrigin}/settings?error=${reason}`);
  }

  // 5) OAuth 완료 즉시 웹의 Rating tier에 맞는 Discord 역할을 지급한다.
  //    실패하더라도 DB 연동은 유지하고 STUDYHUBBOT Realtime/주기 동기화가 재시도한다.
  const roleSynced = await syncDiscordRatingRole(me.id, user.id).catch(() => false);

  return NextResponse.redirect(
    `${siteOrigin}/settings?discord=${roleSynced ? "linked_role" : "linked_role_pending"}`
  );
}
