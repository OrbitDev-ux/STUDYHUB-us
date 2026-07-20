import { createAdminClient } from "@/lib/supabase/server";
import { generateDailyFeedback } from "@/lib/ai/feedback";
import { todayKST } from "@/lib/utils/date";
import { sendDiscordDM, getDiscordUserIdMap } from "@/lib/discord/bot";
import { createNotification } from "@/lib/notifications/create";
import { computeHomeworkCompletionStats } from "@/lib/homework/completion";
import { NextResponse } from "next/server";

/** Vercel Cron에서 매일 23:30 (KST) 경 1회 호출됩니다. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = todayKST();

  const { data: profiles } = await admin.from("profiles").select("id, nickname, target_study_minutes, streak_days");
  const results: { user_id: string; status: string }[] = [];

  // 알림 설정/디스코드 연동 정보를 유저마다 쿼리하는 대신 한 번에 벌크로 가져와 맵으로 조회한다 (N+1 방지).
  const allUserIds = (profiles ?? []).map((p) => p.id as string);
  const notificationEnabledByUserId = new Map<string, boolean>();
  if (allUserIds.length > 0) {
    const { data: settingsRows } = await admin
      .from("settings")
      .select("user_id, notification_enabled")
      .in("user_id", allUserIds);
    for (const s of settingsRows ?? []) {
      notificationEnabledByUserId.set(s.user_id as string, s.notification_enabled as boolean);
    }
  }
  const notifyUserIds = allUserIds.filter((id) => notificationEnabledByUserId.get(id));
  const discordUserIdByUserId = await getDiscordUserIdMap(admin, notifyUserIds);

  for (const profile of profiles ?? []) {
    try {
      const { data: existing } = await admin
        .from("daily_feedback")
        .select("id")
        .eq("user_id", profile.id)
        .eq("date", today)
        .maybeSingle();
      if (existing) {
        results.push({ user_id: profile.id, status: "skipped" });
        continue;
      }

      const { data: sessions } = await admin
        .from("study_sessions")
        .select("focus_minutes")
        .eq("user_id", profile.id)
        .gte("started_at", `${today}T00:00:00+09:00`);
      const studyMinutes = (sessions ?? []).reduce((s: number, x: { focus_minutes: number | null }) => s + (x.focus_minutes ?? 0), 0);

      if (studyMinutes === 0) {
        results.push({ user_id: profile.id, status: "no_activity" });
        continue;
      }

      const { data: homework } = await admin
        .from("homeworks")
        .select("id, homework_items(is_correct)")
        .eq("user_id", profile.id)
        .eq("date", today)
        .maybeSingle();

      const items = homework?.homework_items ?? [];
      const { completionRate, correctRate } = computeHomeworkCompletionStats(items);

      const generated = await generateDailyFeedback({
        nickname: profile.nickname,
        studyMinutes,
        targetMinutes: profile.target_study_minutes ?? 60,
        homeworkCompletionRate: completionRate,
        correctRate,
        improvedUnits: [],
        weakUnits: [],
        streakDays: profile.streak_days ?? 0,
      });

      await admin.from("daily_feedback").insert({
        user_id: profile.id,
        date: today,
        study_minutes: studyMinutes,
        goal_achievement_rate: generated.goal_achievement_rate,
        improved_units: [],
        recommended_next: generated.recommended_next,
        ai_message: generated.ai_message,
      });

      await createNotification(
        admin,
        profile.id,
        "feedback",
        "오늘의 AI 피드백이 도착했어요",
        `목표 달성률 ${generated.goal_achievement_rate}% — 오늘 하루를 AI가 정리했어요.`
      );

      const discordUserId = discordUserIdByUserId.get(profile.id);
      if (discordUserId) {
        await sendDiscordDM(
          discordUserId,
          `📊 오늘의 AI 피드백이 도착했어요! 목표 달성률 ${generated.goal_achievement_rate}% — StudyHub에서 확인해보세요.`
        );
      }

      results.push({ user_id: profile.id, status: "ok" });
    } catch (e) {
      results.push({ user_id: profile.id, status: `error: ${(e as Error).message}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
