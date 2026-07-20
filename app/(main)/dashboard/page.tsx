import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/supabase/profile";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, NotebookPen, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { todayKST } from "@/lib/utils/date";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");

  const today = todayKST();

  const [profile, { data: stats }, { data: todaySessions }, { data: homework }, { data: recentDiagnostics }] =
    await Promise.all([
      getCachedProfile(user.id),
      supabase.from("user_subject_stats").select("*").eq("user_id", user.id),
      supabase.from("study_sessions").select("focus_minutes").eq("user_id", user.id).gte("started_at", `${today}T00:00:00+09:00`),
      supabase
        .from("homeworks")
        .select("*, homework_items(is_correct)")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("diagnostic_results")
        .select("subject_id, weak_units")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const todayMinutes = (todaySessions ?? []).reduce((sum, s) => sum + (s.focus_minutes ?? 0), 0);
  const targetMinutes = profile?.target_study_minutes ?? 60;
  const goalRate = Math.min(200, Math.round((todayMinutes / Math.max(targetMinutes, 1)) * 100));

  const homeworkItems = homework?.homework_items ?? [];
  const answered = homeworkItems.filter((i: { is_correct: boolean | null }) => i.is_correct !== null);
  const homeworkRate = homeworkItems.length ? Math.round((answered.length / homeworkItems.length) * 100) : 0;

  const weakByLatestSubject = new Map<string, { name: string }[]>();
  for (const d of recentDiagnostics ?? []) {
    if (!weakByLatestSubject.has(d.subject_id)) {
      weakByLatestSubject.set(d.subject_id, (d.weak_units as { name: string }[]) ?? []);
    }
  }
  const allWeakUnits = [...weakByLatestSubject.values()].flat().slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("greeting", { nickname: profile?.nickname ?? "" })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label={t("todayMinutesLabel")} value={tc("minutes", { n: todayMinutes })} sub={t("todayMinutesSub", { target: targetMinutes })} />
        <StatCard icon={Flame} label={t("streakLabel")} value={tc("daysSuffix", { days: profile?.streak_days ?? 0 })} sub={t("streakSub")} />
        <StatCard icon={NotebookPen} label={t("homeworkRateLabel")} value={`${homeworkRate}%`} sub={t("homeworkRateSub", { answered: answered.length, total: homeworkItems.length })} />
        <StatCard icon={Target} label={t("goalRateLabel")} value={`${goalRate}%`} sub={t("goalRateSub")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> {t("goalCardTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={Math.min(100, goalRate)} />
          <p className="mt-2 text-sm text-muted-foreground">
            {t("goalCaption", { studied: todayMinutes, target: targetMinutes, rate: goalRate })}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tc("predictedGrade")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {(stats ?? []).length === 0 && (
              <p className="col-span-2 text-sm text-muted-foreground">{t("noDiagnostic")}</p>
            )}
            {(stats ?? []).map((s) => (
              <div key={s.subject_id} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{ts(s.subject_id)}</p>
                <p className="text-xl font-bold">{s.current_grade}</p>
                <p className="text-xs text-muted-foreground">{s.current_percentile_band}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("weakUnitsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {allWeakUnits.length === 0 && <p className="text-sm text-muted-foreground">{t("noWeakUnits")}</p>}
            {allWeakUnits.map((u, i) => (
              <Badge key={i} variant="warning">
                {u.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="flex-1">
          <Link href="/homework">{t("goHomework")}</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/planner">{t("goPlanner")}</Link>
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
