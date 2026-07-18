import { postDiscordJSON } from "./shared";
import type { createAdminClient } from "@/lib/supabase/server";

/**
 * 봇 토큰으로 특정 Discord 유저에게 DM을 보낸다 (매일 숙제/피드백 알림 등).
 * DISCORD_BOT_TOKEN이 없으면 조용히 아무것도 하지 않는다. 알림 실패가 크론
 * 작업 자체(숙제/플랜/피드백 생성)를 막으면 안 되므로 에러를 던지지 않는다.
 */
export async function sendDiscordDM(discordUserId: string, content: string): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;

  const headers = { Authorization: `Bot ${botToken}` };

  const dmChannelRes = await postDiscordJSON("https://discord.com/api/v10/users/@me/channels", headers, {
    recipient_id: discordUserId,
  });
  if (!dmChannelRes) return;

  try {
    const dmChannel = await dmChannelRes.json();
    await postDiscordJSON(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, headers, { content });
  } catch {
    // DM 채널 응답 파싱 실패는 무시 (알림 실패가 호출부를 막지 않는다).
  }
}

/**
 * 여러 유저의 discord_user_id를 한 번에 벌크로 조회해 user_id -> discord_user_id
 * 맵으로 반환한다 (크론에서 유저마다 개별 쿼리하는 N+1을 피하기 위한 공용 헬퍼).
 */
export async function getDiscordUserIdMap(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const { data: links } = await admin.from("discord_links").select("user_id, discord_user_id").in("user_id", userIds);
  for (const link of links ?? []) {
    if (link.discord_user_id) map.set(link.user_id as string, link.discord_user_id as string);
  }
  return map;
}
