import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ensureTodayPlan } from "./actions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanItemList } from "@/components/planner/plan-item-list";

export async function generateMetadata() {
  const t = await getTranslations("planner");
  return { title: t("title") };
}

export default async function PlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("planner");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* 오늘 플랜이 아직 없으면 AI 생성을 기다려야 하는데, 페이지 전체를 막지 않고
          이 부분만 스트리밍해서 첫 방문 체감 속도를 크게 줄인다. */}
      <Suspense fallback={<PlannerSkeleton />}>
        <PlannerContent />
      </Suspense>
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-5 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

async function PlannerContent() {
  const supabase = await createClient();
  const t = await getTranslations("planner");
  const ts = await getTranslations("subjects");

  const planId = await ensureTodayPlan();

  const { data: plan } = await supabase
    .from("study_plans")
    .select("*, study_plan_items(*)")
    .eq("id", planId)
    .single();

  const items = (plan?.study_plan_items ?? [])
    .slice()
    .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
    .map((i: { subject_id: string | null }) => ({ ...i, subject_label: i.subject_id ? ts(i.subject_id) : "" }));

  return (
    <>
      <Card className="bg-accent/50">
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <CardTitle className="text-base">{t("summaryTitle")}</CardTitle>
            <CardDescription className="mt-1 text-foreground/80">{plan?.ai_summary}</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        {t("totalTime", { minutes: plan?.total_planned_minutes ?? 0 })}
      </div>

      <PlanItemList items={items} />
    </>
  );
}
