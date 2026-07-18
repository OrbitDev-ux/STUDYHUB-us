import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensureTodayPlan } from "./actions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Clock } from "lucide-react";
import { PlanItemList } from "@/components/planner/plan-item-list";

export const metadata = { title: "학습 플래너" };

const SUBJECT_LABEL: Record<string, string> = { math: "수학", english: "영어", social: "사회", science: "과학" };

export default async function PlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const planId = await ensureTodayPlan();

  const { data: plan } = await supabase
    .from("study_plans")
    .select("*, study_plan_items(*)")
    .eq("id", planId)
    .single();

  const items = (plan?.study_plan_items ?? [])
    .slice()
    .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
    .map((i: { subject_id: string | null }) => ({ ...i, subject_label: SUBJECT_LABEL[i.subject_id ?? ""] ?? "" }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">오늘의 AI 학습 플래너</h1>
        <p className="mt-1 text-sm text-muted-foreground">시험 일정과 취약점을 고려해 AI가 계획을 세웠어요.</p>
      </div>

      <Card className="bg-accent/50">
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <CardTitle className="text-base">오늘의 계획 요약</CardTitle>
            <CardDescription className="mt-1 text-foreground/80">{plan?.ai_summary}</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />총 계획 시간: {plan?.total_planned_minutes}분
      </div>

      <PlanItemList items={items} />
    </div>
  );
}
