import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Code2, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CodingBattleArena } from "@/components/battle/coding-battle-arena";
import { RatingBadge } from "@/components/battle/rating-identity";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Output Judge 배틀" };

export default async function CodingBattlePage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const initialMatchId = /^[0-9a-f-]{36}$/i.test(params.match ?? "") ? params.match! : null;
  const [{ data: profile }, { data: rating }] = await Promise.all([
    supabase.from("profiles").select("grade_level").eq("id", user.id).single(),
    supabase.from("battle_ratings").select("rating").eq("user_id", user.id).maybeSingle(),
  ]);

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Code2 className="h-6 w-6 text-emerald-500" />Output Judge 배틀</h1>
          <RatingBadge rating={rating?.rating ?? 1200} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">같은 고정 Input을 풀고 출력 답안의 정확성과 제출 속도로 승부합니다.</p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline"><Link href="/battle/play"><ArrowLeft className="h-4 w-4" />객관식 배틀</Link></Button>
        <Button asChild variant="outline"><Link href="/battle"><Trophy className="h-4 w-4" />ELO 랭킹</Link></Button>
      </div>
    </div>
    <CodingBattleArena
      gradeLevel={profile?.grade_level ?? "학년 미설정"}
      rating={rating?.rating ?? 1200}
      initialMatchId={initialMatchId}
    />
  </div>;
}
