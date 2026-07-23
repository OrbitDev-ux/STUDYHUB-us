import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, ListOrdered, Trophy } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { RatingName } from "@/components/battle/rating-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestStanding } from "../../actions";

type ContestAnswerRow = {
  user_id: string;
  question_key: string;
  is_correct: boolean;
  answered_at: string;
};

export default async function ContestStandingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contest } = await supabase.from("contests")
    .select("*")
    .eq("id", id)
    .single();
  if (!contest) notFound();
  const now = Date.now();
  const phase = now < new Date(contest.starts_at).getTime()
    ? "scheduled"
    : now > new Date(contest.ends_at).getTime() ? "finished" : "active";
  if (phase === "finished" && !contest.ratings_finalized_at) {
    await supabase.rpc("finalize_contest_ratings", { p_contest_id: id });
  }

  const [{ data: standingsData }, { data: answersData }] = await Promise.all([
    supabase.rpc("get_contest_leaderboard", {
      p_contest_id: id,
      p_limit: 100,
    }) as unknown as Promise<{ data: ContestStanding[] | null }>,
    createAdminClient().from("contest_answers")
      .select("user_id,question_key,is_correct,answered_at")
      .eq("contest_id", id),
  ]);
  const standings = (standingsData ?? []).map((standing) => ({
    ...standing,
    participation_mode: standing.participation_mode === "unrated"
      ? "unrated" as const
      : contest.is_rated ? "rated" as const : "unrated" as const,
    has_submitted: standing.has_submitted ?? true,
  }));
  const answers = (answersData ?? []) as ContestAnswerRow[];
  const questionKeys = contest.contest_mode === "output_judge"
    ? (Array.isArray(contest.judge_problem_ids) ? contest.judge_problem_ids as string[] : []).map((problemId) => `oj:${problemId}`)
    : Array.isArray(contest.question_keys) ? contest.question_keys as string[] : [];
  const answerMap = new Map(answers.map((answer) => [
    `${answer.user_id}:${answer.question_key}`,
    answer,
  ]));

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button asChild variant="outline"><Link href={`/contests/${id}`}><ArrowLeft className="h-4 w-4" />대회로 돌아가기</Link></Button>
      <div className="flex gap-2">
        {contest.is_rated && <Badge variant="secondary">RATED AVAILABLE</Badge>}
        <Badge variant={phase === "active" ? "success" : "outline"}>{phase === "finished" ? "FINAL" : phase === "active" ? "LIVE" : "SCHEDULED"}</Badge>
      </div>
    </div>

    <div className="py-2 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{contest.title}</h1>
      <p className="mt-3 text-lg font-semibold">{phase === "finished" ? "Final standings" : phase === "active" ? "Live standings" : "Standings"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{contest.contest_mode === "output_judge" ? "고정 Input Output Judge" : "Quiz"} · 문제별 정오 · 제출 시각 · 점수 · Rating 변화를 한 번에 확인합니다.</p>
    </div>

    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-secondary px-4 py-2 font-semibold">
        <ListOrdered className="h-4 w-4" />Standings
      </div>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-20 w-14 border-b border-r border-border bg-muted px-3 py-4 text-center">#</th>
              <th className="sticky left-14 z-20 min-w-56 border-b border-r border-border bg-muted px-4 py-4 text-left">Who</th>
              <th className="min-w-24 border-b border-r border-border px-4 py-4 text-center">=</th>
              <th className="min-w-24 border-b border-r border-border px-4 py-4 text-center"><Clock3 className="mx-auto h-4 w-4" /></th>
              {questionKeys.map((key, index) => <th key={key} className="min-w-24 border-b border-r border-border px-4 py-3 text-center last:border-r-0">
                <Link href={`/contests/${id}`} className="text-base font-bold text-blue-600 underline dark:text-blue-400">{problemLabel(index)}</Link>
                <span className="mt-0.5 block text-xs text-muted-foreground">100</span>
              </th>)}
              {phase === "finished" && <th className="min-w-24 border-b border-border px-4 py-3 text-center">Rating</th>}
            </tr>
          </thead>
          <tbody>
            {!standings.length && <tr><td colSpan={4 + questionKeys.length + (phase === "finished" ? 1 : 0)} className="py-20 text-center text-muted-foreground">아직 참가자가 없습니다.</td></tr>}
            {standings.map((row, index) => <tr key={row.user_id} className="odd:bg-background even:bg-muted/20 hover:bg-accent/50">
              <td className="sticky left-0 z-10 border-b border-r border-border bg-inherit px-3 py-4 text-center font-semibold">{formatRank(row.final_rank ?? index + 1)}</td>
              <td className="sticky left-14 z-10 border-b border-r border-border bg-inherit px-4 py-4">
                <div className="flex items-center gap-2"><RatingName nickname={row.nickname} rating={row.rating} userId={row.user_id} className="font-bold" /><Badge variant={row.participation_mode === "unrated" ? "secondary" : "outline"} className="text-[9px]">{row.participation_mode === "unrated" ? "Unrated" : "Rated"}</Badge></div>
              </td>
              <td className="border-b border-r border-border px-4 py-4 text-center text-lg font-bold">{row.score}</td>
              <td className="border-b border-r border-border px-4 py-4 text-center text-xs text-muted-foreground">{formatPenalty(row.penalty_seconds)}</td>
              {questionKeys.map((key) => {
                const answer = answerMap.get(`${row.user_id}:${key}`);
                return <td key={key} className="border-b border-r border-border px-3 py-3 text-center">
                  {answer
                    ? <><strong className={`block text-lg ${answer.is_correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{answer.is_correct ? "+100" : "-1"}</strong><span className="block text-xs text-muted-foreground">{elapsed(contest.starts_at, answer.answered_at)}</span></>
                    : <span className="text-muted-foreground/50">—</span>}
                </td>;
              })}
              {phase === "finished" && <td className="border-b border-border px-4 py-3 text-center">
                {!row.has_submitted
                  ? <span className="text-xs font-semibold text-muted-foreground">No show</span>
                  : row.participation_mode === "unrated"
                  ? <span className="text-xs font-semibold text-muted-foreground">Unrated</span>
                  : <><strong className={(row.rating_change ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{(row.rating_change ?? 0) >= 0 ? "+" : ""}{row.rating_change ?? 0}</strong><span className="block text-xs text-muted-foreground">{row.rating_after ?? row.rating}</span></>}
              </td>}
            </tr>)}
          </tbody>
        </table>
      </CardContent>
    </Card>

    <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
      <p className="flex items-center gap-2"><span className="font-bold text-green-600">+100</span>정답과 제출 경과 시간</p>
      <p className="flex items-center gap-2"><span className="font-bold text-red-600">-1</span>오답 제출</p>
      <p className="flex items-center gap-2"><Trophy className="h-4 w-4" />Unrated 참가자는 같은 순위표에 표시되지만 Rating은 변하지 않습니다.</p>
    </div>
  </div>;
}

function problemLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function elapsed(startsAt: string, answeredAt: string) {
  const seconds = Math.max(0, Math.floor((new Date(answeredAt).getTime() - new Date(startsAt).getTime()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatPenalty(seconds: number) {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatRank(rank: number) {
  return Number.isInteger(rank) ? rank : rank.toFixed(1);
}
