import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 알림을 하나 적재한다. 알림 기록 실패가 호출부의 핵심 로직(숙제/피드백 생성,
 * 배지 지급 등)을 막으면 안 되므로 에러를 던지지 않고 로그만 남긴다.
 */
export async function createNotification(
  client: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  body: string
): Promise<void> {
  const { error } = await client.from("notifications").insert({ user_id: userId, type, title, body });
  if (error) console.error("[notifications] insert 실패:", error.message);
}

/** checkAndAwardBadges()가 반환한 새 배지들을 알림으로 하나씩 남긴다. */
export async function notifyNewBadges(
  client: SupabaseClient,
  userId: string,
  badges: { code: string; name: string }[]
): Promise<void> {
  for (const badge of badges) {
    await createNotification(client, userId, "badge", "새 배지 획득!", `"${badge.name}" 배지를 획득했어요.`);
  }
}
