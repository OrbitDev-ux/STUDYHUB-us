import { redirect } from "next/navigation";
import { Crown, Medal, Shield, Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BattleArena } from "@/components/battle/battle-arena";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingChart, type RatingPoint } from "@/components/battle/rating-chart";
import { RatingBadge, RatingName, RatingScale } from "@/components/battle/rating-identity";

export const metadata = { title: "문제풀이 배틀" };

type BattleRank = { id: string; nickname: string; avatar_url: string | null; rating: number; games: number; wins: number; losses: number; draws: number };

export default async function BattlePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: rating }, { data: leaders }, { data: ratingHistory }] = await Promise.all([
    supabase.from("profiles").select("grade_level").eq("id", user.id).single(),
    supabase.from("battle_ratings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("get_battle_leaderboard", { limit_count: 10 }) as unknown as Promise<{ data: BattleRank[] | null }>,
    supabase.from("battle_rating_history").select("rating, rating_change, source, created_at").eq("user_id", user.id).order("created_at"),
  ]);
  const myRating = rating?.rating ?? 1200;
  const games = rating?.games ?? 0;
  const winRate = games ? Math.round(((rating?.wins ?? 0) / games) * 100) : 0;
  const storedHistory = (ratingHistory ?? []) as RatingPoint[];
  const chartHistory: RatingPoint[] = storedHistory.some((point) => point.source === "signup")
    ? storedHistory
    : [{ rating: 1200, rating_change: 0, source: "signup", created_at: user.created_at }, ...storedHistory];

  return <div className="flex flex-col gap-6">
    <div><div className="flex items-center gap-3"><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Swords className="h-6 w-6 text-primary" /> 문제풀이 배틀</h1><RatingBadge rating={myRating} /></div><p className="mt-1 text-sm text-muted-foreground">같은 학년의 상대와 5문제로 대결하고 ELO 레이팅을 올려보세요.</p></div>
    <div className="grid grid-cols-3 gap-4">
      <Stat icon={Shield} label="ELO" value={myRating} />
      <Stat icon={Swords} label="전적" value={`${rating?.wins ?? 0}승 ${rating?.losses ?? 0}패`} />
      <Stat icon={Crown} label="승률" value={`${winRate}%`} />
    </div>
    <BattleArena gradeLevel={profile?.grade_level ?? "학년 미설정"} rating={myRating} />
    <Card><CardHeader><CardTitle className="text-base">ELO 레이팅 변화</CardTitle><p className="text-sm text-muted-foreground">가입일의 1200점부터 모든 배틀 결과를 Codeforces 스타일 구간 그래프로 표시합니다.</p></CardHeader><CardContent className="flex flex-col gap-4"><RatingChart history={chartHistory} /><RatingScale /></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Medal className="h-4 w-4 text-warning" /> ELO 상위 랭킹</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-1">{(leaders ?? []).length === 0 && <p className="text-sm text-muted-foreground">첫 배틀의 주인공이 되어보세요.</p>}{(leaders ?? []).map((row, index) => <div key={row.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${row.id === user.id ? "bg-accent" : ""}`}><div className="flex items-center gap-3"><span className="w-5 text-center font-bold text-muted-foreground">{index + 1}</span><RatingName nickname={row.nickname} rating={row.rating} />{row.id === user.id && <Badge variant="secondary">나</Badge>}</div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{row.wins}승 · {row.games}전</span><RatingBadge rating={row.rating} compact /></div></div>)}</CardContent>
    </Card>
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><Icon className="mb-2 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold sm:text-xl">{value}</p></CardContent></Card>;
}
