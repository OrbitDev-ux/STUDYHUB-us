import { getLocale, getTranslations } from "next-intl/server";
import { PomodoroTimer } from "@/components/timer/pomodoro-timer";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { todayKST } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("timer");
  return { title: t("title") };
}

export default async function TimerPage() {
  const t = await getTranslations("timer");
  const ts = await getTranslations("subjects");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayKST();
  const [{ data: settings }, { data: sessions }, { data: recentSessions }] = await Promise.all([
    supabase.from("settings").select("pomodoro_focus_min, pomodoro_break_min").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("study_sessions")
      .select("focus_minutes")
      .eq("user_id", user.id)
      .not("ended_at", "is", null)
      .gte("started_at", `${today}T00:00:00+09:00`),
    supabase
      .from("study_sessions")
      .select("id, subject_id, focus_minutes, break_minutes, ended_at, interrupted")
      .eq("user_id", user.id)
      .not("ended_at", "is", null)
      .gt("focus_minutes", 0)
      .order("ended_at", { ascending: false })
      .limit(8),
  ]);
  const focusMinutes = settings?.pomodoro_focus_min ?? 25;
  const breakMinutes = settings?.pomodoro_break_min ?? 5;
  const todayMinutes = (sessions ?? []).reduce((sum, session) => sum + (session.focus_minutes ?? 0), 0);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle", { focus: focusMinutes, break: breakMinutes })}</p>
      </div>
      <div className="grid w-full items-start gap-6 lg:grid-cols-[minmax(0,384px)_1fr]">
        <PomodoroTimer focusMinutes={focusMinutes} breakMinutes={breakMinutes} todayMinutes={todayMinutes} todaySessions={(sessions ?? []).length} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> {t("recentSessions")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {(recentSessions ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("noSessions")}</p>}
            {(recentSessions ?? []).map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm last:border-0">
                <div>
                  <p className="font-medium">{session.subject_id ? ts(session.subject_id) : t("generalStudy")}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.ended_at).toLocaleString(locale, { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {session.interrupted && <Badge variant="outline" className="text-[10px]">{t("interrupted")}</Badge>}
                  <Badge variant="secondary">{t("focusValue", { minutes: session.focus_minutes ?? 0 })}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
