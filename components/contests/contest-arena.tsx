"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock3, Loader2, Trophy, XCircle } from "lucide-react";
import { getContestState, submitContestAnswer, type ContestState } from "@/app/(main)/contests/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RatingName } from "@/components/battle/rating-identity";

export function ContestArena({ initial }: { initial: ContestState }) {
  const [state, setState] = useState(initial);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; explanation: string } | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const refresh = useCallback(async () => { const result = await getContestState(initial.id); if (result.state) setState(result.state); if (result.error) setError(result.error); }, [initial.id]);
  useEffect(() => { if (feedback) return; const timer = window.setInterval(() => void refresh(), 3000); return () => window.clearInterval(timer); }, [refresh, feedback]);
  const question = useMemo(() => state.questions.find((item) => !state.answeredKeys.includes(item.key)) ?? null, [state]);
  const remaining = Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 1000));

  function answer(choice: string) {
    if (!question || isPending || feedback) return;
    startTransition(async () => {
      const result = await submitContestAnswer(state.id, question.key, choice);
      if (result.error || result.correct === undefined) { setError(result.error ?? "제출 실패"); return; }
      setFeedback({ correct: result.correct, answer: result.answer!, explanation: result.explanation! });
    });
  }
  function next() { setFeedback(null); startTransition(refresh); }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
    <div>
      {state.phase === "scheduled" ? <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Clock3 className="h-10 w-10 text-primary" /><h2 className="text-xl font-bold">대회 시작 전입니다</h2><p className="text-sm text-muted-foreground">{new Date(state.startsAt).toLocaleString("ko-KR")} 시작</p></CardContent></Card>
      : !state.canParticipate ? <Card><CardContent className="py-12 text-center"><p className="font-semibold">{state.gradeLevel} 대상 대회입니다.</p><p className="mt-2 text-sm text-muted-foreground">프로필 학년과 일치할 때 참가할 수 있어요.</p></CardContent></Card>
      : !question || state.phase === "finished" ? <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><Trophy className="h-10 w-10 text-warning" /><h2 className="text-xl font-bold">{state.phase === "finished" ? "대회가 종료되었습니다" : "모든 문제를 제출했습니다"}</h2><p className="text-muted-foreground">{state.score}점 · {state.solved}문제 정답</p></CardContent></Card>
      : <Card><CardHeader className="gap-3"><div className="flex items-center justify-between"><div className="flex gap-2"><Badge variant="outline">{question.unitName}</Badge><Badge variant="warning">난이도 {question.difficulty}</Badge></div><div className="flex items-center gap-2"><Badge variant="secondary"><Clock3 className="mr-1 h-3 w-3" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</Badge><span className="text-sm font-semibold">{state.answeredKeys.length + 1}/{state.questions.length}</span></div></div><Progress value={(state.answeredKeys.length / state.questions.length) * 100} /><CardTitle className="whitespace-pre-line pt-2 text-lg leading-relaxed">{question.content}</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">
        {question.choices.map((choice, index) => <Button key={`${choice}-${index}`} variant="outline" disabled={isPending || Boolean(feedback)} onClick={() => answer(choice)} className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left"><span className="mr-3 rounded-full bg-secondary px-2 py-1 text-xs">{index + 1}</span>{choice}</Button>)}
        {isPending && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}{feedback && <div className={`rounded-xl border p-4 ${feedback.correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}><p className="flex items-center gap-2 font-semibold">{feedback.correct ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}{feedback.correct ? "정답! +100점" : `오답 · 정답은 ${feedback.answer}`}</p><p className="mt-2 text-sm text-muted-foreground">{feedback.explanation}</p><Button onClick={next} className="mt-4 w-full">다음 문제</Button></div>}{error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent></Card>}
    </div>
    <Card><CardHeader><CardTitle className="flex items-center justify-between text-base"><span>실시간 순위표</span>{state.phase === "active" && <Badge variant="success">LIVE</Badge>}</CardTitle></CardHeader><CardContent className="flex flex-col gap-1"><div className="mb-2 grid grid-cols-[32px_1fr_55px_55px] gap-2 text-xs text-muted-foreground"><span>#</span><span>참가자</span><span>점수</span><span>페널티</span></div>{state.standings.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">아직 참가자가 없어요.</p>}{state.standings.map((row, index) => <div key={row.user_id} className="grid grid-cols-[32px_1fr_55px_55px] gap-2 rounded-lg px-1 py-2 text-sm"><strong>{index + 1}</strong><RatingName nickname={row.nickname} rating={row.rating} className="truncate" /><strong>{row.score}</strong><span className="text-xs text-muted-foreground">{Math.floor(row.penalty_seconds / 60)}분</span></div>)}</CardContent></Card>
  </div>;
}
