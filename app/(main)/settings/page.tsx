import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateSettings, startDiscordLink, unlinkDiscord, setMaintenanceMode } from "./actions";
import { AdminPlanManager } from "@/components/settings/admin-plan-manager";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { planLimits } from "@/lib/plan";
import { getUserPlan } from "@/lib/supabase/compat";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const ta = await getTranslations("settings.admin");
  const tp = await getTranslations("plan");

  const [{ data: settings }, { data: discordLink }, { data: profile }, currentPlan] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase.from("discord_links").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getUserPlan(supabase, user.id),
  ]);

  const isAdmin = profile?.role === "admin";
  const maxQuestions = planLimits(currentPlan).homeworkQuestionMax;

  const { data: appSettings } = isAdmin
    ? await supabase.from("app_settings").select("*").eq("id", true).single()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Badge variant="secondary">
          {t("myPlan")}: {tp(currentPlan)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("studySettings")}</CardTitle>
          <CardDescription>{t("studySettingsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="homework_time">{t("homeworkTime")}</Label>
              <Input id="homework_time" name="homework_time" type="time" defaultValue={settings?.homework_time ?? "07:00"} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="homework_question_count">{t("homeworkQuestionCount")}</Label>
              <Input
                id="homework_question_count"
                name="homework_question_count"
                type="number"
                min={5}
                max={maxQuestions}
                defaultValue={Math.min(settings?.homework_question_count ?? 10, maxQuestions)}
              />
              <p className="text-xs text-muted-foreground">{t("homeworkQuestionCountHint", { max: maxQuestions })}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pomodoro_focus_min">{t("focusMinutes")}</Label>
                <Input
                  id="pomodoro_focus_min"
                  name="pomodoro_focus_min"
                  type="number"
                  min={1}
                  max={240}
                  defaultValue={settings?.pomodoro_focus_min ?? 25}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pomodoro_break_min">{t("breakMinutes")}</Label>
                <Input
                  id="pomodoro_break_min"
                  name="pomodoro_break_min"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={settings?.pomodoro_break_min ?? 5}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="notification_enabled"
                  defaultChecked={settings?.notification_enabled ?? true}
                  className="h-4 w-4 rounded border-input"
                />
                {t("notifications")}
              </label>
              <p className="pl-6 text-xs text-muted-foreground">{t("notificationsHint")}</p>
            </div>
            <Button type="submit" className="self-start">
              {tc("save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("discordLink")}</CardTitle>
          <CardDescription>{t("discordLinkDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {discordLink ? (
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="success">{t("linked")}</Badge>
                <span className="text-sm font-medium">{discordLink.discord_username}</span>
                {discordLink.premium_role_granted && <Badge variant="warning">{t("premium")}</Badge>}
              </div>
              <form action={unlinkDiscord}>
                <Button variant="outline" size="sm" type="submit">
                  {t("unlink")}
                </Button>
              </form>
            </div>
          ) : (
            <form action={startDiscordLink}>
              <Button type="submit" variant="outline" className="gap-2">
                {t("linkDiscord")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t("deleteAccount.title")}</CardTitle>
          <CardDescription>{t("deleteAccount.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <Card className="border-warning/50">
            <CardHeader>
              <CardTitle className="text-base">{ta("userPlanTitle")}</CardTitle>
              <CardDescription>{ta("userPlanDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminPlanManager />
            </CardContent>
          </Card>

          <Card className="border-warning/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {ta("title")}
                <Badge variant={appSettings?.maintenance_mode ? "warning" : "outline"} className="text-[10px]">
                  {appSettings?.maintenance_mode ? ta("enabled") : ta("disabled")}
                </Badge>
              </CardTitle>
              <CardDescription>{ta("desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={setMaintenanceMode} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="message">{ta("messageLabel")}</Label>
                  <Input
                    id="message"
                    name="message"
                    defaultValue={appSettings?.maintenance_message ?? ""}
                    placeholder={ta("messagePlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground">{ta("discordNotifyHint")}</p>
                </div>
                {appSettings?.maintenance_mode ? (
                  <Button type="submit" name="enabled" value="off" variant="outline" className="self-start">
                    {ta("disableButton")}
                  </Button>
                ) : (
                  <Button type="submit" name="enabled" value="on" variant="destructive" className="self-start">
                    {ta("enableButton")}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
