import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, Flame, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayKST } from "@/lib/utils/date";
import { calculateStreaks, heatmapDateRange, type ActivityDay } from "@/lib/streak/activity";
import { ActivityHeatmap } from "@/components/streak/activity-heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "학습 스트릭" };

export default async function StreakPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const today = todayKST();
  const range = heatmapDateRange(today);
  const start = range[0]!;

  const [{ data: sessions }, { data: attempts }, { data: homeworks }, { data: plans }] = await Promise.all([
    supabase.from("study_sessions").select("started_at, focus_minutes").eq("user_id", user.id).not("ended_at", "is", null).gte("started_at", `${start}T00:00:00+09:00`),
    supabase.from("practice_attempts").select("attempted_at").eq("user_id", user.id).gte("attempted_at", `${start}T00:00:00+09:00`),
    supabase.from("homeworks").select("date, status").eq("user_id", user.id).gte("date", start),
    supabase.from("study_plans").select("date, study_plan_items(completed)").eq("user_id", user.id).gte("date", start),
  ]);

  const map = new Map<string, ActivityDay>(range.map((date) => [date, { date, minutes: 0, problems: 0, completions: 0, score: 0 }]));
  for (const session of sessions ?? []) {
    const date = todayKST(new Date(session.started_at)); const day = map.get(date); if (!day) continue;
    day.minutes += session.focus_minutes ?? 0; day.score += Math.max(1, Math.ceil((session.focus_minutes ?? 0) / 25));
  }
  for (const attempt of attempts ?? []) {
    const date = todayKST(new Date(attempt.attempted_at)); const day = map.get(date); if (!day) continue;
    day.problems += 1; day.score += 0.5;
  }
  for (const homework of homeworks ?? []) {
    if (homework.status !== "completed") continue; const day = map.get(homework.date); if (!day) continue;
    day.completions += 1; day.score += 2;
  }
  for (const plan of plans ?? []) {
    const completed = (plan.study_plan_items ?? []).filter((item: { completed: boolean }) => item.completed).length;
    const day = map.get(plan.date); if (!day) continue; day.completions += completed; day.score += completed;
  }
  const days = [...map.values()];
  const stats = calculateStreaks(days, today);
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);
  const totalProblems = days.reduce((sum, day) => sum + day.problems, 0);

  return <div className="flex flex-col gap-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Flame className="h-6 w-6 text-warning" /> 학습 스트릭</h1><p className="mt-1 text-sm text-muted-foreground">공부한 날을 잔디로 채우며 꾸준함을 눈으로 확인하세요.</p></div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat icon={Flame} label="현재 스트릭" value={`${stats.current}일`} />
      <Stat icon={Zap} label="최장 스트릭" value={`${stats.longest}일`} />
      <Stat icon={CalendarDays} label="활동한 날" value={`${stats.activeDays}일`} />
      <Stat icon={Clock3} label="누적 집중" value={`${Math.round(totalMinutes / 60)}시간`} />
    </div>
    <Card><CardHeader><CardTitle className="flex items-center justify-between gap-3 text-base"><span>최근 1년 학습 잔디</span><span className="text-xs font-normal text-muted-foreground">{stats.activeDays}일 활동</span></CardTitle></CardHeader><CardContent><ActivityHeatmap days={days} /></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2">
      <Card><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-primary/10 p-3"><CheckCircle2 className="h-6 w-6 text-primary" /></div><div><p className="text-sm text-muted-foreground">최근 1년 문제풀이</p><p className="text-2xl font-bold">{totalProblems}문제</p></div></CardContent></Card>
      <Card><CardContent className="p-5"><p className="font-medium">잔디를 진하게 만드는 활동</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">타이머 집중 학습, 문제은행 풀이, 숙제 완료, 플래너 완료가 모두 반영됩니다.</p></CardContent></Card>
    </div>
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <Card><CardContent className="p-4"><Icon className="mb-2 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></CardContent></Card>;
}
