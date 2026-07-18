import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Flame, Medal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "랭킹 / 배지" };

type LeaderboardRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  streak_days: number;
};

export default async function RankPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: topUsers }, { data: allBadges }, { data: myBadges }] = await Promise.all([
    supabase.rpc("get_leaderboard", { limit_count: 20 }) as unknown as Promise<{
      data: LeaderboardRow[] | null;
    }>,
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
  ]);

  const earnedIds = new Set((myBadges ?? []).map((b) => b.badge_id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">랭킹 & 배지</h1>
        <p className="mt-1 text-sm text-muted-foreground">꾸준함이 곧 실력이에요. XP를 모아 순위를 올려보세요.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-warning" /> XP 랭킹
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
                <span className="font-medium">{u.nickname}</span>
                {u.id === user.id && (
                  <Badge variant="secondary" className="text-[10px]">
                    나
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  Lv.{u.level}
                </Badge>
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-warning" /> {u.streak_days}일
                </span>
                <span className="font-semibold text-foreground">{u.xp} XP</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Medal className="h-4 w-4 text-primary" /> 배지
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(allBadges ?? []).map((b) => {
            const earned = earnedIds.has(b.id);
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
                <p className="text-xs font-semibold">{b.name}</p>
                <p className="text-[11px] text-muted-foreground">{b.description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
