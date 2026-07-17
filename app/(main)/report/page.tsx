import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensureTodayFeedback } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp } from "lucide-react";

export const metadata = { title: "AI 리포트" };

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todayFeedback = await ensureTodayFeedback();

  const { data: history } = await supabase
    .from("daily_feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(14);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI 일일 피드백</h1>
        <p className="mt-1 text-sm text-muted-foreground">오늘 하루를 AI가 요약하고 코칭해드려요.</p>
      </div>

      {!todayFeedback ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            아직 오늘의 학습 기록이 없어요. 숙제를 풀거나 타이머를 사용하면 피드백이 생성돼요.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-accent/50">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <CardTitle className="text-base">오늘의 피드백</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="leading-relaxed text-foreground/90">{todayFeedback.ai_message}</p>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>목표 달성률</span>
                <span>{todayFeedback.goal_achievement_rate}%</span>
              </div>
              <Progress value={Math.min(100, todayFeedback.goal_achievement_rate)} />
            </div>
            <div className="rounded-xl bg-background p-3 text-sm">
              <p className="mb-1 font-medium text-primary">내일 추천</p>
              <p className="text-muted-foreground">{todayFeedback.recommended_next}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> 최근 학습 기록
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(history ?? []).length === 0 && <p className="text-sm text-muted-foreground">기록이 없어요.</p>}
          {(history ?? []).map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
              <span className="text-muted-foreground">{h.date}</span>
              <span>{h.study_minutes}분</span>
              <span className="font-medium">{h.goal_achievement_rate}%</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
