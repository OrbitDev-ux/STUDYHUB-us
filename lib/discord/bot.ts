/**
 * 봇 토큰으로 특정 Discord 유저에게 DM을 보낸다 (매일 숙제/피드백 알림 등).
 * DISCORD_BOT_TOKEN이 없으면 조용히 아무것도 하지 않는다. 알림 실패가 크론
 * 작업 자체(숙제/플랜/피드백 생성)를 막으면 안 되므로 에러를 던지지 않는다.
 */
export async function sendDiscordDM(discordUserId: string, content: string): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;

  try {
    const dmChannelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!dmChannelRes.ok) return;

    const dmChannel = await dmChannelRes.json();

    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
  } catch {
    // 알림 실패는 호출부의 크론 작업을 막지 않는다.
  }
}
