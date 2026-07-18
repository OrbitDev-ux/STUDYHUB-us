import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ensureTodayFeedback } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp } from "lucide-react";
import { planLimits } from "@/lib/plan";

export async function generateMetadata() {
  const t = await getTranslations("report");
  return { title: t("title") };
}

export default async function ReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("report");
  const tc = await getTranslations("common");

  const todayFeedback = await ensureTodayFeedback();

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  const historyLimit = planLimits(profile?.plan).reportHistoryLimit;

  const { data: history } = await supabase
    .from("daily_feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(historyLimit);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {!todayFeedback ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("empty")}</CardContent>
        </Card>
      ) : (
        <Card className="bg-accent/50">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <CardTitle className="text-base">{t("todayFeedback")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="leading-relaxed text-foreground/90">{todayFeedback.ai_message}</p>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{tc("goalAchievementRate")}</span>
                <span>{todayFeedback.goal_achievement_rate}%</span>
              </div>
              <Progress value={Math.min(100, todayFeedback.goal_achievement_rate)} />
            </div>
            <div className="rounded-xl bg-background p-3 text-sm">
              <p className="mb-1 font-medium text-primary">{t("recommendedNext")}</p>
              <p className="text-muted-foreground">{todayFeedback.recommended_next}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> {t("recentHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(history ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noHistory")}</p>}
          {(history ?? []).map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
              <span className="text-muted-foreground">{h.date}</span>
              <span>{tc("minutes", { n: h.study_minutes })}</span>
              <span className="font-medium">{h.goal_achievement_rate}%</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
