import { createClient } from "@/lib/supabase/server";
import { DISCORD_OAUTH_STATE_COOKIE } from "@/lib/discord/oauth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=discord_no_code`);
  }

  // OAuth 로그인 CSRF 방지: startDiscordLink에서 심어둔 쿠키와 state가 일치해야 진행한다.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DISCORD_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(DISCORD_OAUTH_STATE_COOKIE);
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/settings?error=discord_invalid_state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // 1) authorization code를 access token으로 교환
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin}/api/discord/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/settings?error=discord_token_failed`);
  }
  const tokenData = await tokenRes.json();

  // 2) 액세스 토큰으로 Discord 유저 정보 조회
  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!meRes.ok) {
    return NextResponse.redirect(`${origin}/settings?error=discord_user_failed`);
  }
  const me = await meRes.json();

  // 3) 현재 플랜이 이미 Basic/Pro라면 연동 시점에 바로 프리미엄 플래그를 세운다
  //    (반대 방향 - 플랜 변경 시 기존 연동에 반영하는 것 - 은 set_user_plan()이 처리한다).
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const premiumRoleGranted = profile?.plan === "basic" || profile?.plan === "pro";

  // 4) discord_links 테이블에 upsert
  // discord_user_id에도 별도 unique 제약이 있어(이미 다른 계정에 연동된 디스코드),
  // onConflict: "user_id"로는 잡히지 않는 충돌이 날 수 있다. 조용히 무시하면
  // 실패했는데도 "연동 성공" 화면으로 보내게 되므로 에러를 반드시 확인한다.
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
    console.error("[discord/callback] discord_links upsert 실패:", linkError.message);
    const errorCode = linkError.code === "23505" ? "discord_already_linked" : "discord_link_failed";
    return NextResponse.redirect(`${origin}/settings?error=${errorCode}`);
  }

  // 5) (선택) 실제 Discord 길드 역할 부여는 봇 토큰 + 길드 관리 권한이 필요한 서버사이드
  //    작업이라 여기서는 DB 플래그만 세팅하고, 실제 역할 부여는 별도의 Discord 봇
  //    백엔드(또는 route handler + DISCORD_BOT_TOKEN)에서 처리하도록 설계했습니다.

  return NextResponse.redirect(`${origin}/settings?discord=linked`);
}
