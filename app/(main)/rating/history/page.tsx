import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarClock, Crown, Gauge, Medal, ShieldCheck, Swords, Target, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDetailedRatingHistory } from "@/lib/battle/rating-history";
import type { RatingPoint } from "@/lib/battle/rating-history-types";
import { RATING_TIERS, ratingTier } from "@/lib/battle/rating";
import { RatingBadge, RatingName, RatingProgress, RatingScale } from "@/components/battle/rating-identity";
import { RatingChart } from "@/components/battle/rating-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Rating 상세 현황" };

const FILTERS = [
  { value: "all", label: "전체" },
  { value: "battle", label: "배틀" },
  { value: "contest", label: "대회" },
  { value: "admin", label: "운영자 조정" },
];

const EVENT_ICONS = {
  battle: Swords,
  contest: Trophy,
  admin: ShieldCheck,
  signup: CalendarClock,
};

export default async function RatingHistoryDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: rating }, storedHistory, params] = await Promise.all([
    supabase.from("profiles").select("nickname,avatar_url,grade_level").eq("id", user.id).single(),
    supabase.from("battle_ratings").select("rating,peak_rating,games,wins,losses,draws,rated_events").eq("user_id", user.id).maybeSingle(),
    getDetailedRatingHistory(user.id, 300),
    searchParams,
  ]);
  const history: RatingPoint[] = storedHistory.some((point) => point.source === "signup")
    ? storedHistory
    : [{ rating: 1200, rating_change: 0, source: "signup", event_type: "signup", event_title: "Account Created", reason: "가입 시 기본 Rating", created_at: user.created_at }, ...storedHistory];
  const filter = FILTERS.some((item) => item.value === params.type) ? params.type! : "all";
  const filtered = history.filter((point) => filter === "all" || point.event_type === filter);
  const currentRating = rating?.rating ?? history.at(-1)?.rating ?? 1200;
  const tier = ratingTier(currentRating);
  const ratedEvents = history.filter((point) => point.rating_change !== 0);
  const gained = ratedEvents.reduce((sum, point) => sum + Math.max(0, point.rating_change), 0);
  const lost = ratedEvents.reduce((sum, point) => sum + Math.abs(Math.min(0, point.rating_change)), 0);
  const biggestGain = Math.max(0, ...ratedEvents.map((point) => point.rating_change));
  const biggestLoss = Math.min(0, ...ratedEvents.map((point) => point.rating_change));
  const promotions = ratedEvents.filter((point) => tierIndex(point.rating) > tierIndex(point.rating_before ?? point.rating - point.rating_change)).length;

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Button asChild variant="ghost" size="sm" className="-ml-3 mb-2"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />대시보드</Link></Button><h1 className="flex items-center gap-2 text-2xl font-bold"><Gauge className="h-6 w-6" style={{ color: tier.color }} />Rating 상세 현황</h1><p className="mt-1 text-sm text-muted-foreground">획득 점수, 반영 사유, Rating 변화와 티어 이동을 이벤트별로 확인합니다.</p></div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3" style={{ borderColor: tier.color }}><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-secondary font-bold" style={{ boxShadow: `0 0 0 2px ${tier.color}` }}>{profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : profile?.nickname?.[0] ?? "?"}</div><div><RatingName nickname={profile?.nickname ?? "사용자"} rating={currentRating} /><p className="text-xs text-muted-foreground">{profile?.grade_level || "학년 미설정"} · {tier.name}</p></div><RatingBadge rating={currentRating} /></div>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Metric icon={Crown} label="Current Rating" value={currentRating} color={tier.color} />
      <Metric icon={Trophy} label="Peak Rating" value={rating?.peak_rating ?? currentRating} />
      <Metric icon={ArrowUpRight} label="획득 Rating 합계" value={`+${gained}`} positive />
      <Metric icon={ArrowDownRight} label="감소 Rating 합계" value={`-${lost}`} negative />
      <Metric icon={Medal} label="티어 승급" value={`${promotions}회`} />
      <Metric icon={Target} label="Rated Events" value={rating?.rated_events ?? ratedEvents.length} />
    </div>

    <Card>
      <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base"><span>전체 Rating 추이</span><span className="text-xs font-normal text-muted-foreground">최대 상승 +{biggestGain} · 최대 하락 {biggestLoss}</span></CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4"><RatingChart history={history} /><RatingProgress rating={currentRating} /><RatingScale /></CardContent>
    </Card>

    <div className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map((item) => <Button key={item.value} asChild size="sm" variant={filter === item.value ? "default" : "outline"}><Link href={item.value === "all" ? "/rating/history" : `/rating/history?type=${item.value}`}>{item.label}<span className="ml-1 text-[10px] opacity-70">{item.value === "all" ? history.length : history.filter((point) => point.event_type === item.value).length}</span></Link></Button>)}</div>

    <div className="flex flex-col gap-4">
      {!filtered.length && <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">해당 유형의 Rating 이벤트가 없습니다.</CardContent></Card>}
      {filtered.slice().reverse().map((point, index) => <RatingEventCard key={`${point.created_at}-${index}`} point={point} />)}
    </div>
  </div>;
}

function RatingEventCard({ point }: { point: RatingPoint }) {
  const before = point.rating_before ?? point.rating - point.rating_change;
  const beforeTier = ratingTier(before);
  const afterTier = ratingTier(point.rating);
  const beforeIndex = tierIndex(before);
  const afterIndex = tierIndex(point.rating);
  const tierChange = afterIndex > beforeIndex ? "승급" : afterIndex < beforeIndex ? "강등" : null;
  const Icon = EVENT_ICONS[point.event_type as keyof typeof EVENT_ICONS] ?? CalendarClock;

  return <Card className="overflow-hidden" style={{ borderLeftWidth: 4, borderLeftColor: afterTier.color }}>
    <CardContent className="p-0">
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: afterTier.color, backgroundColor: `${afterTier.color}18` }}><Icon className="h-4 w-4" /></span>{point.event_href ? <Link href={point.event_href} className="font-semibold hover:underline">{point.event_title || "Rating Update"}</Link> : <h2 className="font-semibold">{point.event_title || "Rating Update"}</h2>}<span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{point.event_type || point.source}</span>{tierChange && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tierChange === "승급" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>티어 {tierChange}</span>}</div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{point.reason || "Rating 결과 반영"}</p>
          <p className="mt-2 text-xs text-muted-foreground">{new Date(point.created_at).toLocaleString("ko-KR", { dateStyle: "full", timeStyle: "medium" })}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {point.event_score !== null && point.event_score !== undefined && <Detail label={point.event_type === "contest" ? "대회 점수" : "내 점수"} value={`${point.event_score}점`} />}
            {point.opponent_score !== null && point.opponent_score !== undefined && <Detail label="상대 점수" value={`${point.opponent_score}점`} />}
            {point.solved !== null && point.solved !== undefined && <Detail label="정답 수" value={`${point.solved}문제`} />}
            {point.penalty_seconds !== null && point.penalty_seconds !== undefined && (
              <Detail
                label="페널티"
                value={`${Math.floor(point.penalty_seconds / 60)}분 ${point.penalty_seconds % 60}초`}
              />
            )}
            {point.result_label && <Detail label={point.event_type === "contest" ? "최종 순위" : "결과"} value={point.result_label} />}
            {point.actual_rank !== null && point.actual_rank !== undefined && !point.result_label && <Detail label="실제 순위" value={`#${formatRank(point.actual_rank)}`} />}
            {point.expected_rank !== null && point.expected_rank !== undefined && <Detail label="기대 순위" value={`#${formatRank(point.expected_rank)}`} />}
            {point.performance_rating !== null && point.performance_rating !== undefined && <Detail label="Performance" value={point.performance_rating} />}
            {point.provisional_factor !== null && point.provisional_factor !== undefined && <Detail label="신규 보정 배수" value={`×${Number(point.provisional_factor).toFixed(2)}`} />}
          </div>
          {((point.base_delta !== null && point.base_delta !== undefined) || (point.correction !== null && point.correction !== undefined)) && <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">Codeforces 계산: 기본 변화 {signed(point.base_delta ?? 0)} · 전체 필드 보정 {signed(point.correction ?? 0)} · 최종 변화 <strong className={point.rating_change >= 0 ? "text-success" : "text-destructive"}>{signed(point.rating_change)}</strong></div>}
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-xs text-muted-foreground">Rating 변화</p>
          <p className={`mt-1 text-3xl font-bold ${point.rating_change >= 0 ? "text-success" : "text-destructive"}`}>{signed(point.rating_change)}</p>
          <div className="mt-3 flex items-center gap-2 text-sm"><span>{before}</span><span className="text-muted-foreground">→</span><strong>{point.rating}</strong></div>
          <div className="mt-3 border-t border-border pt-3"><p className="text-[10px] text-muted-foreground">Tier 변화</p><div className="mt-1 flex flex-wrap items-center gap-1.5"><span style={{ color: beforeTier.color }} className="text-xs font-semibold">{beforeTier.name}</span><span className="text-muted-foreground">→</span><span style={{ color: afterTier.color }} className="text-xs font-bold">{afterTier.name}</span></div></div>
        </div>
      </div>
    </CardContent>
  </Card>;
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-secondary/50 px-3 py-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-0.5 text-xs font-semibold">{value}</p></div>;
}

function Metric({ icon: Icon, label, value, color, positive, negative }: { icon: React.ElementType; label: string; value: string | number; color?: string; positive?: boolean; negative?: boolean }) {
  return <Card><CardContent className="p-4"><Icon className={`h-4 w-4 ${positive ? "text-success" : negative ? "text-destructive" : "text-primary"}`} style={color ? { color } : undefined} /><p className={`mt-3 text-xl font-bold ${positive ? "text-success" : negative ? "text-destructive" : ""}`}>{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></CardContent></Card>;
}

function tierIndex(rating: number) {
  const name = ratingTier(rating).english;
  return RATING_TIERS.findIndex((tier) => tier.english === name);
}

function formatRank(rank: number) {
  return Number.isInteger(rank) ? rank : rank.toFixed(2);
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}
