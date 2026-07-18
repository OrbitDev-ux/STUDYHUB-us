import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateSettings, startDiscordLink, unlinkDiscord } from "./actions";

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

  const [{ data: settings }, { data: discordLink }] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase.from("discord_links").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pomodoro_focus_min">{t("focusMinutes")}</Label>
                <Input
                  id="pomodoro_focus_min"
                  name="pomodoro_focus_min"
                  type="number"
                  defaultValue={settings?.pomodoro_focus_min ?? 25}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pomodoro_break_min">{t("breakMinutes")}</Label>
                <Input
                  id="pomodoro_break_min"
                  name="pomodoro_break_min"
                  type="number"
                  defaultValue={settings?.pomodoro_break_min ?? 5}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="notification_enabled"
                defaultChecked={settings?.notification_enabled ?? true}
                className="h-4 w-4 rounded border-input"
              />
              {t("notifications")}
            </label>
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
    </div>
  );
}
