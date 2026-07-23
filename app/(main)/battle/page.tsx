import { redirect } from "next/navigation";
import Link from "next/link";
import { Crown, Medal, Swords, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "ELO 상위 랭킹" };

type BattleRank = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
};

export default async function BattleLeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("get_battle_leaderboard", { limit_count: 100 }) as unknown as { data: BattleRank[] | null };
  const leaders = data ?? [];

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Trophy className="h-6 w-6 text-warning" />ELO Leaderboard</h1><p className="mt-1 text-sm text-muted-foreground">문제풀이 배틀과 Rated 대회 결과를 반영한 상위 100명의 순위입니다.</p></div>
      <Button asChild><Link href="/battle/play"><Swords className="h-4 w-4" />배틀 시작</Link></Button>
    </div>

    {leaders.length >= 3 && <div className="grid gap-3 sm:grid-cols-3">
      {[leaders[1], leaders[0], leaders[2]].map((row, displayIndex) => {
        if (!row) return null;
        const rank = displayIndex === 0 ? 2 : displayIndex === 1 ? 1 : 3;
        return <Card key={row.id} className={rank === 1 ? "border-warning bg-warning/5 sm:-translate-y-2" : ""}><CardContent className="flex flex-col items-center p-5 text-center"><span className={`flex h-10 w-10 items-center justify-center rounded-full ${rank === 1 ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"}`}>{rank === 1 ? <Crown className="h-5 w-5" /> : <Medal className="h-5 w-5" />}</span><div className="mt-3"><RatingName nickname={row.nickname} rating={row.rating} userId={row.id} /></div><div className="mt-2"><RatingBadge rating={row.rating} /></div><p className="mt-2 text-xs text-muted-foreground">{row.wins}승 {row.losses}패 {row.draws}무 · {row.games}전</p></CardContent></Card>;
      })}
    </div>}

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Medal className="h-4 w-4 text-warning" />전체 ELO 순위</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!leaders.length && <p className="py-16 text-center text-sm text-muted-foreground">아직 집계된 배틀 순위가 없습니다.</p>}
        <div className="divide-y divide-border">{leaders.map((row, index) => {
          const winRate = row.games ? Math.round(row.wins / row.games * 100) : 0;
          return <div key={row.id} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[54px_minmax(0,1fr)_110px_110px] ${row.id === user.id ? "bg-accent/70" : ""}`}>
            <span className={`text-center font-bold ${index < 3 ? "text-warning" : "text-muted-foreground"}`}>#{index + 1}</span>
            <div className="flex min-w-0 items-center gap-2"><RatingName nickname={row.nickname} rating={row.rating} userId={row.id} className="truncate" />{row.id === user.id && <Badge variant="secondary">나</Badge>}</div>
            <span className="hidden text-right text-xs text-muted-foreground sm:block">{row.wins}승 · 승률 {winRate}%</span>
            <div className="text-right"><RatingBadge rating={row.rating} compact /></div>
          </div>;
        })}</div>
      </CardContent>
    </Card>
  </div>;
}
