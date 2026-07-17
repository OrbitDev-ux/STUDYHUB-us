import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, NotebookPen, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "대시보드" };

const SUBJECT_LABEL: Record<string, string> = { math: "수학", english: "영어", social: "사회", science: "과학" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profile }, { data: stats }, { data: todaySessions }, { data: homework }, { data: recentDiagnostics }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("user_subject_stats").select("*").eq("user_id", user.id),
      supabase.from("study_sessions").select("focus_minutes").eq("user_id", user.id).gte("started_at", `${today}T00:00:00`),
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
        <h1 className="text-2xl font-bold tracking-tight">오늘도 화이팅이에요, {profile?.nickname}님 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">AI가 오늘의 학습 현황을 정리했어요.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="오늘 공부 시간" value={`${todayMinutes}분`} sub={`목표 ${targetMinutes}분`} />
        <StatCard icon={Flame} label="연속 학습" value={`${profile?.streak_days ?? 0}일`} sub="꾸준함이 실력이에요" />
        <StatCard icon={NotebookPen} label="숙제 완료율" value={`${homeworkRate}%`} sub={`${answered.length}/${homeworkItems.length}문제`} />
        <StatCard icon={Target} label="목표 달성률" value={`${goalRate}%`} sub="오늘 기준" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> 오늘 목표 달성률
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={Math.min(100, goalRate)} />
          <p className="mt-2 text-sm text-muted-foreground">
            {todayMinutes}분 / {targetMinutes}분 ({goalRate}%)
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">예상 등급</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {(stats ?? []).length === 0 && (
              <p className="col-span-2 text-sm text-muted-foreground">아직 진단평가 결과가 없어요.</p>
            )}
            {(stats ?? []).map((s) => (
              <div key={s.subject_id} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{SUBJECT_LABEL[s.subject_id]}</p>
                <p className="text-xl font-bold">{s.current_grade}</p>
                <p className="text-xs text-muted-foreground">{s.current_percentile_band}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">취약 단원</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {allWeakUnits.length === 0 && <p className="text-sm text-muted-foreground">취약 단원이 아직 없어요.</p>}
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
          <Link href="/homework">오늘의 숙제 풀기</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/planner">학습 플래너 보기</Link>
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
