import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Flame, Medal, Sparkles, Swords, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PLANS, PLAN_LIMITS } from "@/lib/plan";
import { getUserPlan } from "@/lib/supabase/compat";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { normalizeRatingTiers, ratingTier } from "@/lib/battle/rating";

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
  rating: number;
};

type BattleLeaderboardRow = {
  global_rank: number; total_count: number; id: string; nickname: string; avatar_url: string | null;
  grade_level: string | null; rating: number; peak_rating: number; games: number;
  wins: number; losses: number; draws: number; rated_events: number;
};

const GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];
const PAGE_SIZE = 50;

export default async function RankPage({ searchParams }: { searchParams: Promise<{ q?: string; grade?: string; page?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("rank");
  const tc = await getTranslations("common");
  const tp = await getTranslations("plan");
  const requested = await searchParams;
  const ratingQuery = (requested.q ?? "").trim().slice(0, 50);
  const grade = GRADES.includes(requested.grade ?? "") ? requested.grade! : "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(requested.page ?? "1", 10) || 1));

  const [{ data: topUsers }, { data: ratingLeaders }, { data: allBadges }, { data: myBadges }, currentPlan, { data: ratingSettings }] = await Promise.all([
    supabase.rpc("get_leaderboard", { limit_count: 20 }) as unknown as Promise<{
      data: LeaderboardRow[] | null;
    }>,
    supabase.rpc("get_rating_leaderboard", {
      p_page: page, p_page_size: PAGE_SIZE, p_query: ratingQuery, p_grade_level: grade || null,
    }) as unknown as Promise<{
      data: BattleLeaderboardRow[] | null;
    }>,
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
    getUserPlan(supabase, user.id),
    supabase.from("app_settings").select("rating_tiers").eq("id", true).maybeSingle(),
  ]);
  const ratingTiers = normalizeRatingTiers(ratingSettings?.rating_tiers);

  const earnedIds = new Set((myBadges ?? []).map((b) => b.badge_id));
  const totalCount = Number(ratingLeaders?.[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (ratingQuery) params.set("q", ratingQuery);
    if (grade) params.set("grade", grade);
    if (target > 1) params.set("page", String(target));
    return `/rank${params.size ? `?${params}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">모든 사용자의 Rating 순위를 확인하고 공개 프로필을 둘러보세요.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2"><Swords className="h-4 w-4 text-primary" /> Global Rating Ranking</span>
            <Badge variant="secondary">{totalCount.toLocaleString()}명</Badge>
          </CardTitle>
          <form className="grid gap-2 pt-3 sm:grid-cols-[1fr_120px_auto]" action="/rank">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="q" defaultValue={ratingQuery} maxLength={50} placeholder="닉네임 검색" className="pl-9" /></div>
            <select name="grade" defaultValue={grade} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="">전체 학년</option>
              {GRADES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <Button type="submit">검색</Button>
          </form>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="grid grid-cols-[44px_1fr_76px] gap-2 px-3 pb-2 text-xs text-muted-foreground sm:grid-cols-[54px_1fr_80px_100px_90px]">
            <span>Rank</span><span>User</span><span>Rating</span><span className="hidden sm:block">Record</span><span className="hidden sm:block">Peak</span>
          </div>
          {(ratingLeaders ?? []).length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">조건에 맞는 사용자가 없습니다.</p>}
          {(ratingLeaders ?? []).map((row) => {
            const tier = ratingTier(row.rating, ratingTiers);
            return (
              <div
                key={row.id}
                className={cn(
                  "grid grid-cols-[44px_1fr_76px] items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm transition hover:bg-secondary sm:grid-cols-[54px_1fr_80px_100px_90px]",
                  row.id === user.id && "bg-accent"
                )}
                style={row.id === user.id ? { borderColor: `${tier.color}55` } : undefined}
              >
                <strong className={cn(row.global_rank <= 3 ? "text-warning" : "text-muted-foreground")}>#{row.global_rank}</strong>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Link
                    href={`/users/${row.id}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary font-semibold"
                    style={{
                      borderColor: tier.color,
                      boxShadow: `0 0 0 2px ${tier.color}20`,
                      color: tier.color,
                    }}
                    title={`${tier.name} · Rating ${row.rating}`}
                  >
                    <Avatar src={row.avatar_url} size={36} fallback={row.nickname[0]} />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RatingName nickname={row.nickname} rating={row.rating} userId={row.id} className="truncate" />
                      {row.id === user.id && <Badge variant="secondary" className="text-[9px]">{t("me")}</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {row.grade_level || "학년 미설정"} · <span className="font-medium" style={{ color: tier.color }}>{tier.name}</span> · {row.rated_events} rated
                    </p>
                  </div>
                </div>
                <div>
                  <strong style={{ color: tier.color }}>{row.rating}</strong>
                  <div className="mt-0.5"><RatingBadge rating={row.rating} compact /></div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{row.wins}승 {row.losses}패 {row.draws}무</span>
                <span className="hidden text-xs font-semibold sm:block">{row.peak_rating}</span>
              </div>
            );
          })}
          {totalPages > 1 && <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : ""}><Link href={pageHref(page - 1)}><ChevronLeft className="h-4 w-4" />이전</Link></Button>
            <span className="text-xs text-muted-foreground">{Math.min(page, totalPages)} / {totalPages}</span>
            <Button asChild variant="outline" size="sm" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}><Link href={pageHref(page + 1)}>다음<ChevronRight className="h-4 w-4" /></Link></Button>
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-warning" /> {t("xpRanking")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {(topUsers ?? []).map((u, idx) => {
            const tier = ratingTier(u.rating, ratingTiers);
            return (
              <div
                key={u.id}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm",
                  u.id === user.id && "bg-accent"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-semibold text-muted-foreground">{idx + 1}</span>
                  <Link
                    href={`/users/${u.id}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary text-xs font-semibold"
                    style={{ borderColor: tier.color, color: tier.color }}
                    title={`${tier.name} · Rating ${u.rating}`}
                  >
                    <Avatar src={u.avatar_url} size={32} fallback={u.nickname?.[0] ?? "?"} />
                  </Link>
                  <RatingName nickname={u.nickname} rating={u.rating} userId={u.id} />
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
            );
          })}
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
