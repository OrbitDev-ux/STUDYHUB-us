import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import { saveOnboardingInfo } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"] as const;

export async function generateMetadata() {
  const t = await getTranslations("onboarding");
  return { title: t("pageTitle") };
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const t = await getTranslations("onboarding");
  const tc = await getTranslations("common");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname,onboarding_completed")
    .eq("id", user.id)
    .single();
  if (profile?.onboarding_completed) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md animate-slide-up">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOnboardingInfo} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname">{tc("nickname")}</Label>
              <Input id="nickname" name="nickname" defaultValue={profile?.nickname ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="grade_level">{t("gradeLevel")}</Label>
              <select
                id="grade_level"
                name="grade_level"
                required
                className="h-11 rounded-xl border border-input bg-background px-4 text-sm"
              >
                <option value="">{t("selectPlaceholder")}</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {t(`grades.${g}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="target_study_minutes">{t("targetMinutes")}</Label>
              <Input
                id="target_study_minutes"
                name="target_study_minutes"
                type="number"
                min={10}
                max={600}
                defaultValue={60}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="target_score">{t("targetScore")}</Label>
              <Input id="target_score" name="target_score" placeholder={t("targetScorePlaceholder")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exam_date">{t("examDate")}</Label>
              <Input id="exam_date" name="exam_date" type="date" />
            </div>
            {params.error && (
              <p className="text-sm text-destructive">
                {params.error === "invalid_input" ? t("invalidInputError") : t("saveError")}
              </p>
            )}
            <Button type="submit" className="mt-2">
              {t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
