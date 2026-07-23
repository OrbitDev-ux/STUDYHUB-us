import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateProfile } from "./actions";
import { Flame, Zap, Coins, Clock } from "lucide-react";
import { ProfileMediaEditor } from "@/components/profile/profile-media-editor";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("profile") };
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const ts = await getTranslations("subjects");
  const tp = await getTranslations("plan");

  const [{ data: profile }, { data: stats }, { data: badgeCount }, { data: totalSessions }, { data: battleRating }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_subject_stats").select("*").eq("user_id", user.id),
    supabase.from("user_badges").select("id", { count: "exact" }).eq("user_id", user.id),
    supabase.from("study_sessions").select("focus_minutes").eq("user_id", user.id),
    supabase.from("battle_ratings").select("rating, games, wins, peak_rating").eq("user_id", user.id).maybeSingle(),
  ]);

  const totalMinutes = (totalSessions ?? []).reduce((s, x) => s + (x.focus_minutes ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <ProfileMediaEditor
        userId={user.id}
        nickname={profile?.nickname ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        bannerUrl={profile?.banner_url ?? null}
      />

      <div className="flex items-end justify-between px-2">
        <div className="flex flex-1 items-end justify-between pb-1">
          <div>
            <h1 className="text-xl"><RatingName nickname={profile?.nickname ?? ""} rating={battleRating?.rating ?? 1200} className="text-xl" /></h1>
            <p className="text-sm text-muted-foreground">{profile?.grade_level}</p>
          </div>
          <Badge variant="secondary">{tp(profile?.plan ?? "free")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatChip icon={Zap} label="XP" value={profile?.xp ?? 0} />
        <StatChip icon={Coins} label={tc("coins")} value={profile?.coins ?? 0} />
        <StatChip icon={Flame} label={tc("streak")} value={tc("daysSuffix", { days: profile?.streak_days ?? 0 })} />
        <StatChip icon={Clock} label={t("totalStudyTime")} value={tc("hours", { n: Math.round(totalMinutes / 60) })} />
        <Card><CardContent className="flex flex-col items-center gap-1 p-4 text-center"><RatingBadge rating={battleRating?.rating ?? 1200} compact /><p className="text-lg font-bold">{battleRating?.rating ?? 1200}</p><p className="text-xs text-muted-foreground">ELO · 최고 {battleRating?.peak_rating ?? 1200}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("subjectSkills")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(stats ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noDiagnostic")}</p>}
          {(stats ?? []).map((s) => (
            <Badge key={s.subject_id} variant="secondary">
              {ts(s.subject_id)} {s.current_grade}
            </Badge>
          ))}
          <Badge variant="outline">{t("badgeCount", { count: badgeCount?.length ?? 0 })}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("editProfile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname">{tc("nickname")}</Label>
              <Input id="nickname" name="nickname" defaultValue={profile?.nickname ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bio">{t("bio")}</Label>
              <Input id="bio" name="bio" defaultValue={profile?.bio ?? ""} placeholder={t("bioPlaceholder")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="grade_level">학년</Label>
                <select id="grade_level" name="grade_level" defaultValue={profile?.grade_level ?? "중1"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"].map((grade) => <option key={grade}>{grade}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="target_study_minutes">하루 목표 공부 시간(분)</Label>
                <Input id="target_study_minutes" name="target_study_minutes" type="number" min={10} max={600} defaultValue={profile?.target_study_minutes ?? 60} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="target_score">목표 성적</Label>
                <Input id="target_score" name="target_score" maxLength={100} defaultValue={profile?.target_score ?? ""} placeholder="예: 전 과목 A, 상위 10%" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="exam_date">시험 날짜</Label>
                <Input id="exam_date" name="exam_date" type="date" defaultValue={profile?.exam_date ?? ""} />
              </div>
            </div>
            <Button type="submit" className="self-start">
              {tc("save")}
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
