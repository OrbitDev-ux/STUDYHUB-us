import { getTranslations } from "next-intl/server";
import { PomodoroTimer } from "@/components/timer/pomodoro-timer";

export async function generateMetadata() {
  const t = await getTranslations("timer");
  return { title: t("title") };
}

export default async function TimerPage() {
  const t = await getTranslations("timer");

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="w-full max-w-sm">
        <PomodoroTimer />
      </div>
    </div>
  );
}
