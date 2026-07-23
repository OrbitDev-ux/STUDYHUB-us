import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, NotebookPen, Target, TrendingUp, BarChart3, CalendarCheck2, LibraryBig, ListTree, Swords } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { todayKST } from "@/lib/utils/date";
import { RatingBadge } from "@/components/battle/rating-identity";
import { RatingProgress, RatingScale } from "@/components/battle/rating-identity";
import { RatingChart, type RatingPoint } from "@/components/battle/rating-chart";
import { getDetailedRatingHistory } from "@/lib/battle/rating-history";

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

  const weekStart = todayKST(new Date(Date.now() - 6 * 86400000));
  const [{ data: profile }, { data: stats }, { data: todaySessions }, { data: homework }, { data: recentDiagnostics }, { data: weekSessions }, { data: todayPlan }, { data: practiceAttempts }, { data: battleRating }, ratingHistory] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
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
      supabase
        .from("study_sessions")
        .select("started_at, focus_minutes")
        .eq("user_id", user.id)
        .not("ended_at", "is", null)
        .gte("started_at", `${weekStart}T00:00:00+09:00`),
      supabase
        .from("study_plans")
        .select("study_plan_items(completed)")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase.from("practice_attempts").select("is_correct").eq("user_id", user.id),
      supabase.from("battle_ratings").select("rating, wins, games").eq("user_id", user.id).maybeSingle(),
      getDetailedRatingHistory(user.id),
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

  const weekDates = Array.from({ length: 7 }, (_, index) => todayKST(new Date(Date.now() - (6 - index) * 86400000)));
  const minutesByDate = new Map(weekDates.map((date) => [date, 0]));
  for (const session of weekSessions ?? []) {
    const date = todayKST(new Date(session.started_at));
    if (minutesByDate.has(date)) minutesByDate.set(date, (minutesByDate.get(date) ?? 0) + (session.focus_minutes ?? 0));
  }
  const weekValues = weekDates.map((date) => minutesByDate.get(date) ?? 0);
  const weekTotal = weekValues.reduce((sum, value) => sum + value, 0);
  const activeDays = weekValues.filter((value) => value > 0).length;
  const weekAverage = activeDays ? Math.round(weekTotal / activeDays) : 0;
  const maxDailyMinutes = Math.max(targetMinutes, ...weekValues, 1);
  const planItems = todayPlan?.study_plan_items ?? [];
  const completedPlanItems = planItems.filter((item: { completed: boolean }) => item.completed).length;
  const planRate = planItems.length ? Math.round((completedPlanItems / planItems.length) * 100) : 0;
  const practiceCorrect = (practiceAttempts ?? []).filter((item) => item.is_correct).length;
  const practiceRate = practiceAttempts?.length ? Math.round(practiceCorrect / practiceAttempts.length * 100) : 0;
  const storedRatingHistory = (ratingHistory ?? []) as RatingPoint[];
  const chartHistory: RatingPoint[] = storedRatingHistory.some((point) => point.source === "signup")
    ? storedRatingHistory
    : [{ rating: 1200, rating_change: 0, source: "signup", event_type: "signup", event_title: "Account Created", reason: "가입 시 기본 Rating", created_at: user.created_at }, ...storedRatingHistory];
  const currentRating = battleRating?.rating ?? 1200;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("greeting", { nickname: profile?.nickname ?? "" })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard icon={Clock} label={t("todayMinutesLabel")} value={tc("minutes", { n: todayMinutes })} sub={t("todayMinutesSub", { target: targetMinutes })} />
        <StatCard icon={Flame} label={t("streakLabel")} value={tc("daysSuffix", { days: profile?.streak_days ?? 0 })} sub={t("streakSub")} />
        <StatCard icon={NotebookPen} label={t("homeworkRateLabel")} value={`${homeworkRate}%`} sub={t("homeworkRateSub", { answered: answered.length, total: homeworkItems.length })} />
        <StatCard icon={Target} label={t("goalRateLabel")} value={`${goalRate}%`} sub={t("goalRateSub")} />
        <StatCard icon={LibraryBig} label="문제은행" value={`${practiceRate}%`} sub={`${practiceAttempts?.length ?? 0}문제 풀이`} />
        <StatCard icon={Swords} label="배틀 ELO" value={<span className="flex flex-wrap items-center gap-2"><span>{battleRating?.rating ?? 1200}</span><RatingBadge rating={battleRating?.rating ?? 1200} compact /></span>} sub={`${battleRating?.wins ?? 0}승 · ${battleRating?.games ?? 0}전`} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
          <div><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" />Rating History</CardTitle><p className="mt-1 text-sm text-muted-foreground">가입 시점부터 배틀·대회·운영자 조정에 따른 Rating 변화를 표시합니다. 그래프의 점을 누르면 이벤트와 사유를 확인할 수 있습니다.</p></div>
          <div className="flex items-center gap-2"><div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1 text-xs"><span className="rounded-md bg-background px-3 py-1.5 font-semibold shadow-sm">그래프</span><Link href="/rating/history" className="flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-background hover:text-foreground"><ListTree className="h-3.5 w-3.5" />자세히 보기</Link></div><RatingBadge rating={currentRating} /></div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RatingChart history={chartHistory} />
          <RatingProgress rating={currentRating} />
          <RatingScale />
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button asChild variant="secondary" size="sm"><Link href="/rating/history"><ListTree className="h-4 w-4" />Rating 상세 현황</Link></Button><Button asChild variant="outline" size="sm"><Link href="/battle">ELO 전체 랭킹</Link></Button><Button asChild size="sm"><Link href="/battle/play"><Swords className="h-4 w-4" />배틀 시작</Link></Button></div>
        </CardContent>
      </Card>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> {t("weeklyTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-6 text-sm">
              <div><p className="text-xs text-muted-foreground">{t("weeklyTotal")}</p><p className="font-semibold">{tc("minutes", { n: weekTotal })}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("activeDays")}</p><p className="font-semibold">{tc("daysSuffix", { days: activeDays })}</p></div>
              <div><p className="text-xs text-muted-foreground">{t("dailyAverage")}</p><p className="font-semibold">{tc("minutes", { n: weekAverage })}</p></div>
            </div>
            <div className="flex h-32 items-end gap-2" aria-label={t("weeklyTitle")}>
              {weekDates.map((date, index) => {
                const value = weekValues[index] ?? 0;
                return (
                  <div key={date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{value || ""}</span>
                    <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-secondary">
                      <div className="w-full rounded-md bg-primary transition-all" style={{ height: `${Math.max(value ? 8 : 0, (value / maxDailyMinutes) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{date.slice(5).replace("-", "/")}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck2 className="h-4 w-4 text-success" /> {t("planProgressTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-3xl font-bold">{planRate}%</div>
            <Progress value={planRate} />
            <p className="text-xs text-muted-foreground">{t("planProgressCaption", { completed: completedPlanItems, total: planItems.length })}</p>
            <Button asChild variant="outline" size="sm"><Link href="/planner">{t("goPlanner")}</Link></Button>
          </CardContent>
        </Card>
      </div>

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
        <Button asChild variant="outline" className="flex-1">
          <Link href="/streak">학습 잔디 보기</Link>
        </Button>
        <Button asChild variant="secondary" className="flex-1">
          <Link href="/practice">학년별 문제은행</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/battle/play">배틀 시작</Link>
        </Button>
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
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
