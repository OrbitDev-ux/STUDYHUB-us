/**
 * Discord로 보내는 JSON POST 요청 공통 래퍼. 네트워크/HTTP 실패는 삼키고 null을
 * 반환한다 — 알림 실패가 호출부의 핵심 로직(크론 작업, 점검 모드 토글)을 막으면
 * 안 되기 때문이다.
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
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}
