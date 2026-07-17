import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=discord_no_code`);
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

  // 3) discord_links 테이블에 upsert
  await supabase.from("discord_links").upsert(
    {
      user_id: user.id,
      discord_user_id: me.id,
      discord_username: `${me.username}`,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  // 4) (선택) 길드 멤버 역할 지급은 봇 토큰 + 길드 관리 권한이 필요한 서버사이드 작업이라
  //    여기서는 자리표시(premium_role_granted=false)만 하고, 실제 역할 부여는
  //    별도의 Discord 봇 백엔드(또는 route handler + DISCORD_BOT_TOKEN)에서 처리하도록 설계했습니다.

  return NextResponse.redirect(`${origin}/settings?discord=linked`);
}
