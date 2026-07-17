import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateSettings, startDiscordLink, unlinkDiscord } from "./actions";

export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: settings }, { data: discordLink }] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase.from("discord_links").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">학습 환경을 나에게 맞게 조정해요.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">학습 설정</CardTitle>
          <CardDescription>매일 숙제 생성 시각과 타이머 기본값을 설정해요</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="homework_time">매일 숙제 생성 시각</Label>
              <Input id="homework_time" name="homework_time" type="time" defaultValue={settings?.homework_time ?? "07:00"} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pomodoro_focus_min">집중 시간(분)</Label>
                <Input
                  id="pomodoro_focus_min"
                  name="pomodoro_focus_min"
                  type="number"
                  defaultValue={settings?.pomodoro_focus_min ?? 25}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pomodoro_break_min">휴식 시간(분)</Label>
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
              알림 받기
            </label>
            <Button type="submit" className="self-start">
              저장
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discord 연동</CardTitle>
          <CardDescription>Discord 계정을 연동하면 XP·배지가 동기화되고 프리미엄 역할이 지급돼요</CardDescription>
        </CardHeader>
        <CardContent>
          {discordLink ? (
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="success">연동됨</Badge>
                <span className="text-sm font-medium">{discordLink.discord_username}</span>
                {discordLink.premium_role_granted && <Badge variant="warning">프리미엄</Badge>}
              </div>
              <form action={unlinkDiscord}>
                <Button variant="outline" size="sm" type="submit">
                  연동 해제
                </Button>
              </form>
            </div>
          ) : (
            <form action={startDiscordLink}>
              <Button type="submit" variant="outline" className="gap-2">
                Discord 계정 연동하기
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
