"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateDailyStudyPlan } from "@/lib/ai/planner";
import { todayKST } from "@/lib/utils/date";
import type { SubjectId } from "@/types";

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

  const [{ data: profile }, { data: diagnostics }, { data: yesterdayPlan }] = await Promise.all([
    supabase.from("profiles").select("grade_level, target_study_minutes, exam_date").eq("id", user.id).single(),
    supabase
      .from("diagnostic_results")
      .select("subject_id, weak_units")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("study_plans")
      .select("id, study_plan_items(title, completed)")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .maybeSingle(),
  ]);

  const weakBySubject = new Map<SubjectId, string[]>();
  for (const d of diagnostics ?? []) {
    if (!weakBySubject.has(d.subject_id)) {
      weakBySubject.set(
        d.subject_id,
        ((d.weak_units as { name: string }[]) ?? []).map((u) => u.name)
      );
    }
  }

  const incomplete = (yesterdayPlan?.study_plan_items ?? [])
    .filter((i: { completed: boolean }) => !i.completed)
    .map((i: { title: string }) => i.title);

  const generated = await generateDailyStudyPlan({
    gradeLevel: profile?.grade_level ?? "중2",
    examDate: profile?.exam_date ?? null,
    targetMinutes: profile?.target_study_minutes ?? 60,
    weakUnitsBySubject: [...weakBySubject.entries()].map(([subject, units]) => ({ subject, units })),
    yesterdayIncomplete: incomplete,
  });

  const totalMinutes = generated.items.reduce((s, i) => s + i.planned_minutes, 0);

  const { data: plan, error } = await supabase
    .from("study_plans")
    .insert({ user_id: user.id, date: today, total_planned_minutes: totalMinutes, ai_summary: generated.summary })
    .select("id")
    .single();

  if (error || !plan) throw new Error(error?.message ?? "플래너 생성 실패");

  await supabase.from("study_plan_items").insert(
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

  revalidatePath("/planner");
  return plan.id as string;
}

export async function togglePlanItem(itemId: string, completed: boolean) {
  const supabase = await createClient();
  await supabase.from("study_plan_items").update({ completed }).eq("id", itemId);
  revalidatePath("/planner");
}
