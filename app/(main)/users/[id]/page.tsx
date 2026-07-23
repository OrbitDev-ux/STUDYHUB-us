import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CalendarDays, Flame, Pencil, ShieldCheck, Swords, Trophy, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RatingBadge, RatingName, RatingProgress, RatingScale } from "@/components/battle/rating-identity";
import { RatingChart } from "@/components/battle/rating-chart";
import { RatingHistoryList } from "@/components/battle/rating-history-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ratingTier } from "@/lib/battle/rating";
import { getDetailedRatingHistory } from "@/lib/battle/rating-history";

export const metadata = { title: "사용자 프로필" };

type PublicProfile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string;
  grade_level: string | null;
  xp: number;
  level: number;
  streak_days: number;
  joined_at: string;
  rating: number;
  peak_rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  rated_events: number;
  global_rank: number;
  badge_count: number;
};

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [{ data: profileRows }, historyRows] = await Promise.all([
    supabase.rpc("get_public_profile", { p_user_id: id }) as unknown as Promise<{ data: PublicProfile[] | null }>,
    getDetailedRatingHistory(id),
  ]);
  const profile = profileRows?.[0];
  if (!profile) notFound();

  const tier = ratingTier(profile.rating);
  const storedHistory = historyRows ?? [];
  const history = storedHistory.some((point) => point.source === "signup")
    ? storedHistory
    : [{ rating: 1200, rating_change: 0, source: "signup", event_type: "signup", event_title: "Account Created", reason: "가입 시 기본 Rating", created_at: profile.joined_at }, ...storedHistory];
  const winRate = profile.games ? Math.round((profile.wins / profile.games) * 100) : 0;

  return <div className="flex flex-col gap-6">
    <Card className="overflow-hidden" style={{ borderColor: tier.color, boxShadow: `0 12px 44px ${tier.color}20` }}>
      <div
        className="h-36 bg-cover bg-center"
        style={profile.banner_url
          ? { backgroundImage: `linear-gradient(90deg, ${tier.color}33, transparent), url(${profile.banner_url})` }
          : { background: `linear-gradient(135deg, ${tier.color}cc, ${tier.graphFill}66)` }}
      />
      <CardContent className="relative pb-6 pt-0">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 bg-background text-3xl font-bold" style={{ borderColor: tier.color }}>
              {profile.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                : profile.nickname[0]}
            </div>
            <div className="pb-1">
              <h1 className="text-2xl"><RatingName nickname={profile.nickname} rating={profile.rating} className="text-2xl" /></h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{profile.grade_level || "학년 미설정"}</span>
                <span>·</span>
                <span>{new Date(profile.joined_at).toLocaleDateString("ko-KR")} 가입</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pb-1">
            <Button asChild variant="outline" size="sm"><Link href="/rank"><Trophy className="h-4 w-4" />전체 순위</Link></Button>
            {user.id !== profile.id && <Button asChild size="sm"><Link href={`/battle/play?q=${encodeURIComponent(profile.nickname)}`}><Swords className="h-4 w-4" />대결 요청</Link></Button>}
            {user.id === profile.id && <Button asChild size="sm"><Link href="/profile"><Pencil className="h-4 w-4" />프로필 편집</Link></Button>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <RatingBadge rating={profile.rating} />
          <Badge variant="outline" style={{ borderColor: tier.color, color: tier.color }}>{tier.name} Profile</Badge>
          <Badge variant="secondary">Global #{profile.global_rank}</Badge>
          <Badge variant="outline">Peak {profile.peak_rating}</Badge>
        </div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{profile.bio || "아직 작성한 소개가 없습니다."}</p>
      </CardContent>
    </Card>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <PublicStat icon={Trophy} label="Rating" value={profile.rating} color={tier.color} />
      <PublicStat icon={ShieldCheck} label="Global Rank" value={`#${profile.global_rank}`} color={tier.color} />
      <PublicStat icon={Swords} label="Battles" value={profile.games} color={tier.color} />
      <PublicStat icon={Award} label="Win Rate" value={`${winRate}%`} color={tier.color} />
      <PublicStat icon={Zap} label="XP" value={profile.xp} color={tier.color} />
      <PublicStat icon={Flame} label="Streak" value={`${profile.streak_days}일`} color={tier.color} />
      <PublicStat icon={CalendarDays} label="Rated Events" value={profile.rated_events} color={tier.color} />
      <PublicStat icon={Award} label="Badges" value={profile.badge_count} color={tier.color} />
    </div>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>Rating History</span>
          <span className="text-xs font-normal text-muted-foreground">{profile.wins}승 {profile.losses}패 {profile.draws}무</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RatingChart history={history} />
        <RatingProgress rating={profile.rating} />
        <RatingScale />
        <RatingHistoryList history={history} />
      </CardContent>
    </Card>
  </div>;
}

function PublicStat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return <Card style={{ borderColor: `${color}55`, background: `linear-gradient(145deg, ${color}0d, transparent)` }}><CardContent className="flex flex-col items-center gap-1 p-4 text-center">
    <Icon className="h-4 w-4" style={{ color }} />
    <strong style={{ color }}>{value}</strong>
    <span className="text-[11px] text-muted-foreground">{label}</span>
  </CardContent></Card>;
}
