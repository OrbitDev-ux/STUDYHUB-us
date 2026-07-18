import { createAdminClient } from "@/lib/supabase/server";
import { generateDailyHomework } from "@/lib/ai/homework";
import { generateDailyStudyPlan } from "@/lib/ai/planner";
import { insertHomeworkItems } from "@/lib/homework/persist";
import { getWeakUnitsBySubject } from "@/lib/homework/weak-units";
import { todayKST, currentHourKST } from "@/lib/utils/date";
import { sendDiscordDM, getDiscordUserIdMap } from "@/lib/discord/bot";
import { NextResponse } from "next/server";

/**
 * Vercel Cron 등에서 매시간 호출됩니다.
 * 각 사용자의 settings.homework_time이 현재 시각(±5분)과 일치하면
 * 오늘의 숙제와 학습 플래너를 생성합니다.
 * vercel.json의 crons 설정과 짝을 이룹니다.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = todayKST();
  // settings.homework_time은 사용자가 설정 화면에서 고른 한국 현지 시각이므로
  // UTC 시(getUTCHours)가 아니라 KST 시로 비교해야 한다.
  const currentHour = currentHourKST();

  const { data: dueUsers } = await admin
    .from("settings")
    .select(
      "user_id, homework_time, homework_question_count, notification_enabled, profiles(grade_level, target_study_minutes, exam_date, plan)"
    )
    .filter("homework_time", "gte", `${String(currentHour).padStart(2, "0")}:00`)
    .filter("homework_time", "lt", `${String(currentHour + 1).padStart(2, "0")}:00`);

  const notifyUserIds = (dueUsers ?? []).filter((r) => r.notification_enabled).map((r) => r.user_id as string);
  const discordUserIdByUserId = await getDiscordUserIdMap(admin, notifyUserIds);

  const results: { user_id: string; status: string }[] = [];

  for (const row of dueUsers ?? []) {
    try {
      const userId = row.user_id as string;
      const profile = row.profiles as unknown as {
        grade_level: string;
        target_study_minutes: number;
        exam_date: string | null;
        plan: string;
      };
      const discordUserId = discordUserIdByUserId.get(userId);

      // 이번 실행에서 새로 만든 게 있을 때만 알림을 보낸다 (크론 재시도로 같은 시간대에
      // 두 번 호출돼도 이미 존재하면 건너뛰므로, 중복 DM을 막는 기준이기도 하다).
      let createdSomething = false;

      const { data: existingHw } = await admin
        .from("homeworks")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      const { data: existingPlan } = await admin
        .from("study_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      // 숙제/플래너 둘 다 이미 있으면 진단 데이터를 조회할 필요가 없다.
      const weakUnitsBySubject =
        !existingHw || !existingPlan ? await getWeakUnitsBySubject(admin, userId) : [];

      if (!existingHw) {
        const generated = await generateDailyHomework({
          gradeLevel: profile?.grade_level ?? "중2",
          weakUnitsBySubject,
          wrongQuestionSummaries: [],
          targetMinutes: profile?.target_study_minutes ?? 60,
          requestedQuestionCount: (row.homework_question_count as number | null) ?? 10,
          plan: profile?.plan,
        });

        const { data: homework } = await admin
          .from("homeworks")
          .insert({ user_id: userId, date: today, status: "pending", ai_rationale: generated.rationale })
          .select("id")
          .single();

        if (homework) {
          await insertHomeworkItems(admin, homework.id, generated.items);
          createdSomething = true;
        }
      }

      if (!existingPlan) {
        const plan = await generateDailyStudyPlan({
          gradeLevel: profile?.grade_level ?? "중2",
          examDate: profile?.exam_date ?? null,
          targetMinutes: profile?.target_study_minutes ?? 60,
          weakUnitsBySubject,
          yesterdayIncomplete: [],
        });

        const totalMinutes = plan.items.reduce((s, i) => s + i.planned_minutes, 0);
        const { data: planRow } = await admin
          .from("study_plans")
          .insert({ user_id: userId, date: today, total_planned_minutes: totalMinutes, ai_summary: plan.summary })
          .select("id")
          .single();

        await admin.from("study_plan_items").insert(
          plan.items.map((item, idx) => ({
            plan_id: planRow!.id,
            subject_id: item.subject_id,
            title: item.title,
            planned_minutes: item.planned_minutes,
            priority: item.priority,
            type: item.type,
            order_index: idx,
          }))
        );
        createdSomething = true;
      }

      if (createdSomething && row.notification_enabled && discordUserId) {
        await sendDiscordDM(
          discordUserId,
          "🎯 오늘의 AI 숙제와 학습 플래너가 준비됐어요! StudyHub에서 확인해보세요."
        );
      }

      results.push({ user_id: userId, status: "ok" });
    } catch (e) {
      results.push({ user_id: row.user_id as string, status: `error: ${(e as Error).message}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
