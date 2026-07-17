import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateProfile } from "./actions";
import { Flame, Zap, Coins, Clock } from "lucide-react";

export const metadata = { title: "프로필" };

const SUBJECT_LABEL: Record<string, string> = { math: "수학", english: "영어", social: "사회", science: "과학" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: stats }, { data: badgeCount }, { data: totalSessions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_subject_stats").select("*").eq("user_id", user.id),
    supabase.from("user_badges").select("id", { count: "exact" }).eq("user_id", user.id),
    supabase.from("study_sessions").select("focus_minutes").eq("user_id", user.id),
  ]);

  const totalMinutes = (totalSessions ?? []).reduce((s, x) => s + (x.focus_minutes ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="h-32 w-full rounded-2xl bg-gradient-to-br from-primary/70 to-accent" />

      <div className="-mt-16 flex items-end gap-4 px-2">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-background bg-secondary text-3xl font-bold">
          {profile?.nickname?.[0] ?? "?"}
        </div>
        <div className="pb-1">
          <h1 className="text-xl font-bold">{profile?.nickname}</h1>
          <p className="text-sm text-muted-foreground">{profile?.grade_level}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatChip icon={Zap} label="XP" value={profile?.xp ?? 0} />
        <StatChip icon={Coins} label="코인" value={profile?.coins ?? 0} />
        <StatChip icon={Flame} label="연속학습" value={`${profile?.streak_days ?? 0}일`} />
        <StatChip icon={Clock} label="누적 공부시간" value={`${Math.round(totalMinutes / 60)}시간`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">과목별 실력</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(stats ?? []).length === 0 && <p className="text-sm text-muted-foreground">아직 진단 결과가 없어요.</p>}
          {(stats ?? []).map((s) => (
            <Badge key={s.subject_id} variant="secondary">
              {SUBJECT_LABEL[s.subject_id]} {s.current_grade}
            </Badge>
          ))}
          <Badge variant="outline">배지 {badgeCount?.length ?? 0}개</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">프로필 수정</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname">닉네임</Label>
              <Input id="nickname" name="nickname" defaultValue={profile?.nickname ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bio">소개</Label>
              <Input id="bio" name="bio" defaultValue={profile?.bio ?? ""} placeholder="한 줄 소개를 남겨보세요" />
            </div>
            <Button type="submit" className="self-start">
              저장
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
