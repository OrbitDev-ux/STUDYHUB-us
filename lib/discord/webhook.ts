/**
 * 점검 모드 on/off를 Discord 채널로 알린다. DISCORD_MAINTENANCE_WEBHOOK_URL이
 * 설정 안 돼 있으면 조용히 아무것도 하지 않는다 (필수 기능이 아니므로).
 * 웹훅 전송 실패가 점검 모드 자체를 막으면 안 되므로 호출부에서 항상 안전하게
 * 무시할 수 있도록 에러를 던지지 않는다.
 */
export async function notifyMaintenanceModeChange(enabled: boolean, message: string | null) {
  const webhookUrl = process.env.DISCORD_MAINTENANCE_WEBHOOK_URL;
  if (!webhookUrl) return;

  const embed = {
    title: enabled ? "🔧 점검 모드 시작" : "✅ 점검 모드 종료",
    description: enabled ? message ?? "점검이 시작되었습니다." : "서비스가 정상적으로 재개되었습니다.",
    color: enabled ? 0xf59e0b : 0x22c55e,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch {
    // 알림 실패는 점검 모드 토글 자체를 막지 않는다.
  }
}
