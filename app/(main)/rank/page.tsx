import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Flame, Medal, Sparkles, Swords } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PLANS, PLAN_LIMITS } from "@/lib/plan";
import { getUserPlan } from "@/lib/supabase/compat";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";

export async function generateMetadata() {
  const t = await getTranslations("rank");
  return { title: t("title") };
}

type LeaderboardRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  streak_days: number;
};

type BattleLeaderboardRow = {
  id: string; nickname: string; avatar_url: string | null;
  rating: number; games: number; wins: number; losses: number; draws: number;
};

export default async function RankPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("rank");
  const tc = await getTranslations("common");
  const tp = await getTranslations("plan");

  const [{ data: topUsers }, { data: battleLeaders }, { data: allBadges }, { data: myBadges }, currentPlan] = await Promise.all([
    supabase.rpc("get_leaderboard", { limit_count: 20 }) as unknown as Promise<{
      data: LeaderboardRow[] | null;
    }>,
    supabase.rpc("get_battle_leaderboard", { limit_count: 10 }) as unknown as Promise<{
      data: BattleLeaderboardRow[] | null;
    }>,
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
    getUserPlan(supabase, user.id),
  ]);

  const earnedIds = new Set((myBadges ?? []).map((b) => b.badge_id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-warning" /> {t("xpRanking")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {(topUsers ?? []).map((u, idx) => (
            <div
              key={u.id}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm",
                u.id === user.id && "bg-accent"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-semibold text-muted-foreground">{idx + 1}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : u.nickname?.[0] ?? "?"}
                </div>
                <span className="font-medium">{u.nickname}</span>
                {u.id === user.id && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t("me")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {tc("levelBadge", { level: u.level })}
                </Badge>
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-warning" /> {tc("daysSuffix", { days: u.streak_days })}
                </span>
                <span className="font-semibold text-foreground">{t("xpValue", { xp: u.xp })}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="h-4 w-4 text-primary" /> 배틀 ELO 랭킹
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {(battleLeaders ?? []).length === 0 && <p className="text-sm text-muted-foreground">아직 배틀 기록이 없어요.</p>}
          {(battleLeaders ?? []).map((row, index) => (
            <div key={row.id} className={cn("flex items-center justify-between rounded-xl px-3 py-2.5 text-sm", row.id === user.id && "bg-accent")}>
              <div className="flex items-center gap-3"><span className="w-6 text-center font-semibold text-muted-foreground">{index + 1}</span><RatingName nickname={row.nickname} rating={row.rating} />{row.id === user.id && <Badge variant="secondary" className="text-[10px]">{t("me")}</Badge>}</div>
              <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{row.wins}승 · {row.games}전</span><RatingBadge rating={row.rating} compact /></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Medal className="h-4 w-4 text-primary" /> {t("badges")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(allBadges ?? []).map((b) => {
            const earned = earnedIds.has(b.id);
            const known = t.has(`badgeInfo.${b.code}.name`);
            const name = known ? t(`badgeInfo.${b.code}.name`) : b.name;
            const description = known ? t(`badgeInfo.${b.code}.desc`) : b.description;
            return (
              <div
                key={b.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center",
                  !earned && "opacity-40 grayscale"
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-xl">
                  🏅
                </div>
                <p className="text-xs font-semibold">{name}</p>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> {tp("compareTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const limits = PLAN_LIMITS[plan];
            const isCurrent = currentPlan === plan;
            return (
              <div
                key={plan}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4",
                  isCurrent ? "border-primary bg-accent/50" : "border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{tp(plan)}</p>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-[10px]">
                      {tp("yourPlan")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <p>
                    {tp("homeworkLimitLabel")}: {tp("questionsValue", { max: limits.homeworkQuestionMax })}
                  </p>
                  <p>
                    {tp("reportLimitLabel")}: {tc("daysSuffix", { days: limits.reportHistoryLimit })}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
