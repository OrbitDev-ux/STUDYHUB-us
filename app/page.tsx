import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Brain, Target, Flame, NotebookPen, Timer, Trophy } from "lucide-react";

const FEATURE_KEYS = ["diagnostic", "weakness", "homework", "timer", "streak", "feedback"] as const;
const FEATURE_ICONS = { diagnostic: Brain, weakness: Target, homework: NotebookPen, timer: Timer, streak: Flame, feedback: Trophy };

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");

  return (
    <main className="min-h-screen bg-background">
      <header className="container flex h-16 items-center justify-between">
        <span className="text-lg font-bold tracking-tight">StudyHub</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="ghost" asChild>
            <Link href="/login">{tc("login")}</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">{t("navSignup")}</Link>
          </Button>
        </div>
      </header>

      <section className="container flex flex-col items-center gap-6 py-24 text-center animate-fade-in">
        <div className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
          {t("badge")}
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          {t("heroTitleLine1")}
          <br /> {t("heroTitleLine2")}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">{t("heroSubtitle")}</p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <Link href="/signup">{t("ctaPrimary")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">{tc("login")}</Link>
          </Button>
        </div>
      </section>

      <section className="container grid grid-cols-1 gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_KEYS.map((key) => {
          const Icon = FEATURE_ICONS[key];
          return (
            <Card key={key} className="animate-slide-up">
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{t(`features.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`features.${key}.desc`)}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {t("footer", { year: new Date().getFullYear() })}
      </footer>
    </main>
  );
}
