import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateSettings, startDiscordLink, unlinkDiscord, setMaintenanceMode, sendDiscordBotTest } from "./actions";
import { AdminPlanManager } from "@/components/settings/admin-plan-manager";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { planLimits } from "@/lib/plan";
import { getUserPlan } from "@/lib/supabase/compat";
import { AccountSecurity } from "@/components/settings/account-security";
import { SupabaseStatus } from "@/components/settings/supabase-status";
import { isDeveloperRole } from "@/lib/developer/roles";
import { DiscordLinkCodeGenerator } from "@/components/settings/discord-link-code";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; discord?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const ta = await getTranslations("settings.admin");
  const tp = await getTranslations("plan");
  const params = await searchParams;

  const [{ data: settings }, { data: discordLink }, { data: profile }, currentPlan, { data: botStatus }] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase.from("discord_links").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    getUserPlan(supabase, user.id),
    supabase.from("discord_bot_status")
      .select("connected,bot_username,guild_count,command_count,last_seen_at")
      .eq("id", true).maybeSingle(),
  ]);

  const isAdmin = isDeveloperRole(profile?.role);
  const maxQuestions = planLimits(currentPlan).homeworkQuestionMax;
  const botOnline = Boolean(botStatus?.connected && botStatus.last_seen_at
    && Date.now() - new Date(botStatus.last_seen_at).getTime() < 150_000);
  const { error: socialSchemaError } = await supabase.from("battle_rating_history").select("id").limit(1);

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
          <CardTitle className="text-base">Supabase Integration</CardTitle>
          <CardDescription>인증, 데이터베이스 스키마와 실시간 연결 상태입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupabaseStatus schemaReady={!socialSchemaError} />
        </CardContent>
      </Card>

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
          <CardTitle className="text-base">계정 및 보안</CardTitle>
          <CardDescription>비밀번호, 로그인 기기, 내 학습 데이터를 안전하게 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSecurity email={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("discordLink")}</CardTitle>
          <CardDescription>{t("discordLinkDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {params.error?.startsWith("discord_") && (
            <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {params.error === "discord_already_linked"
                ? "이 Discord 계정은 이미 다른 StudyHub 계정에 연동되어 있습니다."
                : params.error === "discord_config_missing"
                  ? "Discord Client ID, Client Secret 또는 Callback URL 설정이 누락되었습니다."
                  : params.error === "discord_config_invalid"
                    ? "Discord Callback URL 설정이 올바르지 않습니다. 관리자에게 문의해주세요."
                : params.error === "discord_invalid_state"
                  ? "연동 요청이 만료되었거나 유효하지 않습니다. 다시 시도해주세요."
                  : "Discord 계정 연동에 실패했습니다. 잠시 후 다시 시도해주세요."}
            </p>
          )}
          {params.discord === "linked_role" && <p className="mb-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">Discord 연동과 현재 Rating 역할 지급이 완료되었습니다.</p>}
          {params.discord === "linked_role_pending" && <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">계정 연동은 완료되었습니다. 봇이 온라인이 되면 Rating 역할을 자동 동기화합니다.</p>}
          {params.discord === "test_sent" && <p className="mb-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">Discord 테스트 DM을 전송했습니다. 봇과의 연결이 정상입니다.</p>}
          {params.discord === "test_failed" && <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">테스트 DM을 전송하지 못했습니다. 봇 토큰, DM 허용 여부와 봇 상태를 확인해주세요.</p>}
          {discordLink ? (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">
                <Badge variant="success">{t("linked")}</Badge>
                <span className="text-sm font-medium">{discordLink.discord_username}</span>
                {discordLink.premium_role_granted && <Badge variant="warning">{t("premium")}</Badge>}
              </div><div className="flex gap-2"><form action={sendDiscordBotTest}><Button variant="outline" size="sm" type="submit">테스트 DM</Button></form><form action={unlinkDiscord}>
                <Button variant="outline" size="sm" type="submit">
                  {t("unlink")}
                </Button>
              </form></div></div>
              <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={botOnline ? "success" : "secondary"}>{botOnline ? "BOT ONLINE" : "BOT OFFLINE"}</Badge><span>{botStatus?.bot_username ?? "STUDYHUBBOT"}</span>{botOnline && <span>· {botStatus?.guild_count ?? 0}개 서버 · {botStatus?.command_count ?? 0}개 명령</span>}</div>
                <p className="mt-2 leading-5">Discord에서 <strong>/연동코드</strong>, <strong>/내정보</strong>, <strong>/알림</strong>, <strong>/대회</strong>, <strong>/레이팅</strong>, <strong>/퍼포먼스</strong>, <strong>/역할동기화</strong> 명령으로 StudyHub와 상호작용할 수 있습니다.</p>
              </div>
            </div>
          ) : (
            <form action={startDiscordLink}>
              <Button type="submit" variant="outline" className="gap-2">
                {t("linkDiscord")}
              </Button>
            </form>
          )}
          <DiscordLinkCodeGenerator />
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
