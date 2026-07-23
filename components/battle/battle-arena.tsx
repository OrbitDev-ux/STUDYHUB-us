"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Loader2, Search, Shield, Swords, Trophy, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cancelBattle, getBattleState, joinBattle, submitBattleAnswer, type BattleState } from "@/app/(main)/battle/actions";
import type { SubjectId } from "@/types";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";

const SUBJECTS: { id: SubjectId; label: string; emoji: string }[] = [
  { id: "math", label: "수학", emoji: "🔢" }, { id: "english", label: "영어", emoji: "🔤" },
  { id: "social", label: "사회", emoji: "🌏" }, { id: "science", label: "과학", emoji: "🧪" },
];

type Feedback = { correct: boolean; answer: string; explanation: string };

export function BattleArena({ gradeLevel, rating }: { gradeLevel: string; rating: number }) {
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectId>("math");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(180);
  const [isPending, startTransition] = useTransition();
  const questionStartedAt = useRef(Date.now());

  const refresh = useCallback(async (id: string) => {
    const result = await getBattleState(id);
    if (result.error) setError(result.error);
    if (result.state) setBattle(result.state);
  }, []);

  useEffect(() => {
    if (!matchId || feedback || battle?.status === "completed" || battle?.status === "cancelled") return;
    const timer = window.setInterval(() => void refresh(matchId), 1500);
    return () => window.clearInterval(timer);
  }, [matchId, feedback, battle?.status, refresh]);

  useEffect(() => {
    if (!battle?.expiresAt || battle.status !== "active") return;
    const update = () => setRemaining(Math.max(0, Math.ceil((new Date(battle.expiresAt!).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [battle?.expiresAt, battle?.status]);
  useEffect(() => { if (battle?.status === "completed") router.refresh(); }, [battle?.status, router]);

  const currentQuestion = useMemo(() => battle?.questions.find((question) => !battle.myAnsweredKeys.includes(question.key)) ?? null, [battle]);
  const currentQuestionKey = currentQuestion?.key;
  useEffect(() => { if (currentQuestionKey) questionStartedAt.current = Date.now(); }, [currentQuestionKey]);

  function startMatch() {
    setError(""); setFeedback(null);
    startTransition(async () => {
      const result = await joinBattle(subject);
      if (result.error || !result.matchId) { setError(result.error ?? "매칭에 실패했습니다."); return; }
      setMatchId(result.matchId);
      await refresh(result.matchId);
    });
  }

  function answer(choice: string) {
    if (!matchId || !currentQuestion || feedback || isPending) return;
    startTransition(async () => {
      const result = await submitBattleAnswer(matchId, currentQuestion.key, choice, Date.now() - questionStartedAt.current);
      if (result.error || result.correct === undefined) { setError(result.error ?? "제출에 실패했습니다."); return; }
      setFeedback({ correct: result.correct, answer: result.answer!, explanation: result.explanation! });
    });
  }

  function nextQuestion() {
    if (!matchId) return;
    setFeedback(null);
    startTransition(async () => refresh(matchId));
  }

  function reset() {
    setMatchId(null); setBattle(null); setFeedback(null); setError(""); setRemaining(180);
  }

  if (!battle) return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Swords className="h-5 w-5 text-primary" /> 배틀 매칭</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-4">
          {SUBJECTS.map((item) => (
            <button key={item.id} type="button" onClick={() => setSubject(item.id)} className={`rounded-xl border p-4 text-left transition ${subject === item.id ? "border-primary bg-accent" : "border-border hover:bg-secondary"}`}>
              <span className="text-2xl">{item.emoji}</span><p className="mt-2 font-semibold">{item.label}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4 text-sm">
          <span><strong>{gradeLevel}</strong> 학생과 5문제 대결</span>
          <span className="flex items-center gap-1"><Shield className="h-4 w-4 text-primary" /> 내 ELO <strong>{rating}</strong></span>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="lg" onClick={startMatch} disabled={isPending} className="gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 같은 학년 상대 찾기
        </Button>
      </CardContent>
    </Card>
  );

  if (battle.status === "waiting") return (
    <Card><CardContent className="flex flex-col items-center gap-5 py-14 text-center">
      <div className="relative"><Swords className="h-12 w-12 text-primary" /><span className="absolute -right-2 -top-2 h-4 w-4 animate-ping rounded-full bg-primary" /></div>
      <div><h2 className="text-xl font-bold">상대를 찾고 있어요</h2><p className="mt-2 text-sm text-muted-foreground">{gradeLevel} · {SUBJECTS.find((item) => item.id === subject)?.label} 대기열</p></div>
      <Button variant="outline" onClick={() => startTransition(async () => { await cancelBattle(battle.id); reset(); })}>매칭 취소</Button>
    </CardContent></Card>
  );

  if (battle.status === "cancelled") return <Card><CardContent className="flex flex-col items-center gap-4 py-12"><p>취소된 배틀입니다.</p><Button onClick={reset}>새 배틀</Button></CardContent></Card>;

  if (battle.status === "completed") {
    const delta = (battle.myRatingAfter ?? battle.myRatingBefore) - battle.myRatingBefore;
    return <Card><CardContent className="flex flex-col items-center gap-5 py-10 text-center">
      <div className={`flex h-20 w-20 items-center justify-center rounded-full ${battle.winner === "me" ? "bg-warning/20" : "bg-secondary"}`}>
        {battle.winner === "me" ? <Trophy className="h-10 w-10 text-warning" /> : <Swords className="h-10 w-10 text-muted-foreground" />}
      </div>
      <div><h2 className="text-2xl font-bold">{battle.winner === "me" ? "승리!" : battle.winner === "draw" ? "무승부" : "아쉽게 패배"}</h2><p className="mt-1 text-muted-foreground">나 {battle.myScore} : {battle.opponentScore} <RatingName nickname={battle.opponent?.nickname ?? "상대"} rating={battle.opponentRatingBefore ?? 1200} /></p></div>
      <div className="rounded-xl border border-border px-8 py-4"><p className="text-xs text-muted-foreground">ELO 레이팅</p><p className="mt-1 text-2xl font-bold">{battle.myRatingAfter} <span className={`text-sm ${delta >= 0 ? "text-success" : "text-destructive"}`}>{delta >= 0 ? "+" : ""}{delta}</span></p><div className="mt-2"><RatingBadge rating={battle.myRatingAfter ?? battle.myRatingBefore} /></div></div>
      <Button onClick={reset} className="gap-2"><Swords className="h-4 w-4" /> 다시 배틀하기</Button>
    </CardContent></Card>;
  }

  if (!currentQuestion) return <Card><CardContent className="flex flex-col items-center gap-4 py-14 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><h2 className="font-bold">상대의 풀이를 기다리는 중...</h2><p className="text-sm text-muted-foreground">내 점수 {battle.myScore} · 상대 점수 {battle.opponentScore}</p></CardContent></Card>;

  const progress = battle.myAnsweredKeys.length;
  return <Card>
    <CardHeader className="gap-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div><strong>나 {battle.myScore}</strong><span className="mx-2 text-muted-foreground">vs</span><strong>{battle.opponentScore} </strong><RatingName nickname={battle.opponent?.nickname ?? "상대"} rating={battle.opponentRatingBefore ?? 1200} /></div>
        <Badge variant={remaining <= 30 ? "warning" : "secondary"}><Clock3 className="mr-1 h-3 w-3" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</Badge>
      </div>
      <Progress value={(progress / 5) * 100} />
      <div className="flex gap-2"><Badge variant="outline">{currentQuestion.unitName}</Badge><Badge variant="warning">난이도 {currentQuestion.difficulty}</Badge></div>
      <CardTitle className="whitespace-pre-line text-lg leading-relaxed">{currentQuestion.content}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      {currentQuestion.choices.map((choice, index) => (
        <Button key={`${choice}-${index}`} variant="outline" disabled={Boolean(feedback) || isPending} onClick={() => answer(choice)} className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left">
          <span className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs">{index + 1}</span>{choice}
        </Button>
      ))}
      {feedback && <div className={`mt-2 rounded-xl border p-4 ${feedback.correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
        <p className="flex items-center gap-2 font-semibold">{feedback.correct ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}{feedback.correct ? "정답!" : `정답은 ${feedback.answer}`}</p>
        <p className="mt-2 text-sm text-muted-foreground">{feedback.explanation}</p>
        <Button onClick={nextQuestion} className="mt-4 w-full">{progress >= 4 ? "결과 확인" : "다음 문제"}</Button>
      </div>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}
