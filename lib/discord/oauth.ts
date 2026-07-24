/** startDiscordLink와 /api/discord/callback이 공유하는 CSRF state 쿠키 이름. */
export const DISCORD_OAUTH_STATE_COOKIE = "discord_oauth_state";

/**
 * Discord는 authorize 요청과 token 교환 요청의 redirect_uri가 완전히 같고,
 * Developer Portal에 등록된 Redirect URL과도 일치해야 요청을 허용한다.
 *
 * 요청 Host/Origin을 사용하면 localhost, 127.0.0.1, 프록시 도메인이 섞일 수 있으므로
 * 반드시 하나의 환경 변수에서 두 단계가 공유할 고정 URL을 만든다.
 */
export function getDiscordOAuthRedirectUri() {
  const explicitRedirect = process.env.DISCORD_REDIRECT_URI?.trim();
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const rawUrl = explicitRedirect
    || (configuredSite ? new URL("/api/discord/callback", configuredSite).toString() : "");

  if (!rawUrl) {
    throw new Error("DISCORD_REDIRECT_URI 또는 NEXT_PUBLIC_SITE_URL이 필요합니다.");
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(rawUrl);
  } catch {
    throw new Error("Discord OAuth Callback URL 형식이 올바르지 않습니다.");
  }

  if (!["http:", "https:"].includes(redirectUrl.protocol)
    || redirectUrl.username
    || redirectUrl.password
    || redirectUrl.search
    || redirectUrl.hash) {
    throw new Error("Discord OAuth Callback URL은 쿼리나 인증 정보가 없는 HTTP(S) URL이어야 합니다.");
  }

  return redirectUrl.toString();
}
