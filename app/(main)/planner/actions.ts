"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateDailyStudyPlan } from "@/lib/ai/planner";
import { getWeakUnitsBySubject } from "@/lib/homework/weak-units";
import { todayKST } from "@/lib/utils/date";

export async function ensureTodayPlan() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayKST();
  const yesterday = todayKST(new Date(Date.now() - 86400000));

  const { data: existing } = await supabase
    .from("study_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) return existing.id as string;

  const [{ data: profile }, weakUnitsBySubject, { data: yesterdayPlan }] = await Promise.all([
    supabase.from("profiles").select("grade_level, target_study_minutes, exam_date").eq("id", user.id).single(),
    getWeakUnitsBySubject(supabase, user.id),
    supabase
      .from("study_plans")
      .select("id, study_plan_items(title, completed)")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .maybeSingle(),
  ]);

  const incomplete = (yesterdayPlan?.study_plan_items ?? [])
    .filter((i: { completed: boolean }) => !i.completed)
    .map((i: { title: string }) => i.title);

  const generated = await generateDailyStudyPlan({
    gradeLevel: profile?.grade_level ?? "중2",
    examDate: profile?.exam_date ?? null,
    targetMinutes: profile?.target_study_minutes ?? 60,
    weakUnitsBySubject,
    yesterdayIncomplete: incomplete,
  });

  const totalMinutes = generated.items.reduce((s, i) => s + i.planned_minutes, 0);

  const { data: plan, error } = await supabase
    .from("study_plans")
    .insert({ user_id: user.id, date: today, total_planned_minutes: totalMinutes, ai_summary: generated.summary })
    .select("id")
    .single();

  if (error || !plan) throw new Error(error?.message ?? "플래너 생성 실패");

  // study_plan_items에는 부모 소유권 기반 INSERT 정책이 없을 수 있으므로, 서버가 방금
  // 만든 본인 plan에 한해서 service role로 항목을 저장한다.
  const admin = createAdminClient();
  const { error: itemsError } = await admin.from("study_plan_items").insert(
    generated.items.map((item, idx) => ({
      plan_id: plan.id,
      subject_id: item.subject_id,
      title: item.title,
      planned_minutes: item.planned_minutes,
      priority: item.priority,
      type: item.type,
      order_index: idx,
    }))
  );
  if (itemsError) {
    await admin.from("study_plans").delete().eq("id", plan.id).eq("user_id", user.id);
    throw new Error(`플래너 항목 저장 실패: ${itemsError.message}`);
  }

  return plan.id as string;
}

export async function togglePlanItem(itemId: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("study_plan_items").update({ completed }).eq("id", itemId);
  if (error) throw new Error(`플래너 상태 변경 실패: ${error.message}`);
  revalidatePath("/planner");
}
