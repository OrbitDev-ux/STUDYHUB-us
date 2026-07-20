const DISCORD_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Discord로 보내는 JSON POST 요청 공통 래퍼. 네트워크/HTTP 실패는 삼키고 null을
 * 반환한다 — 알림 실패가 호출부의 핵심 로직(크론 작업, 점검 모드 토글)을 막으면
 * 안 되기 때문이다. 다만 원인 파악이 가능하도록 실패는 로그로 남기고, 응답이
 * 없는 요청이 무한정 매달리지 않도록 타임아웃을 둔다.
 */
export async function postDiscordJSON(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[discord] ${url} 요청 실패:`, res.status, await res.text().catch(() => ""));
      return null;
    }
    return res;
  } catch (e) {
    console.error(`[discord] ${url} 요청 예외:`, e);
    return null;
  }
}
