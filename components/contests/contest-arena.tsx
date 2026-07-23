"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Code2, ListOrdered, Loader2, Send, ShieldCheck, Trophy, UserPlus, XCircle } from "lucide-react";
import { getContestState, registerForContest, submitContestAnswer, submitContestJudgeOutput, unregisterFromContest, type ContestState } from "@/app/(main)/contests/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RatingName } from "@/components/battle/rating-identity";
import { createClient } from "@/lib/supabase/client";

export function ContestArena({ initial }: { initial: ContestState }) {
  const [state, setState] = useState(initial);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; explanation: string } | null>(null);
  const [judgeOutput, setJudgeOutput] = useState("");
  const [judgeVerdict, setJudgeVerdict] = useState<"accepted" | "wrong_answer" | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now() + (new Date(initial.serverNow).getTime() - Date.now()));
  const refresh = useCallback(async () => { const result = await getContestState(initial.id); if (result.state) setState(result.state); if (result.error) setError(result.error); }, [initial.id]);
  useEffect(() => {
    if (feedback) return;
    const supabase = createClient();
    const channel = supabase.channel(`contest:${initial.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contest_entries", filter: `contest_id=eq.${initial.id}` }, () => void refresh())
      .subscribe();
    const fallback = window.setInterval(() => void refresh(), 15000);
    return () => { window.clearInterval(fallback); void supabase.removeChannel(channel); };
  }, [initial.id, refresh, feedback]);
  useEffect(() => {
    if (state.phase !== "scheduled") return;
    const delay = new Date(state.startsAt).getTime() - new Date(state.serverNow).getTime();
    if (delay <= 0) {
      void refresh();
      return;
    }
    if (delay > 2_147_000_000) return;
    const timer = window.setTimeout(() => void refresh(), delay + 250);
    return () => window.clearTimeout(timer);
  }, [refresh, state.phase, state.serverNow, state.startsAt]);
  const question = useMemo(() => state.questions.find((item) => !state.answeredKeys.includes(item.key)) ?? null, [state]);
  const judgeProblem = useMemo(() => state.judgeProblems.find((item) => !state.answeredKeys.includes(`oj:${item.id}`)) ?? null, [state]);
  const answeredJudgeCount = state.answeredKeys.filter((key) => key.startsWith("oj:")).length;
  const remaining = Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - nowMs) / 1000));
  useEffect(() => {
    const serverOffset = new Date(state.serverNow).getTime() - Date.now();
    const tick = () => setNowMs(Date.now() + serverOffset);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state.serverNow]);

  function answer(choice: string) {
    if (!question || isPending || feedback) return;
    startTransition(async () => {
      const result = await submitContestAnswer(state.id, question.key, choice);
      if (result.error || result.correct === undefined) { setError(result.error ?? "제출 실패"); return; }
      setFeedback({ correct: result.correct, answer: result.answer!, explanation: result.explanation! });
    });
  }
  function next() { setFeedback(null); startTransition(refresh); }
  function submitJudgeOutput() {
    if (!judgeProblem || isPending || judgeVerdict || !judgeOutput.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await submitContestJudgeOutput(state.id, judgeProblem.id, judgeOutput);
      if (result.error || !result.verdict) { setError(result.error ?? "제출 실패"); return; }
      setJudgeVerdict(result.verdict);
    });
  }
  function nextJudgeProblem() {
    setJudgeOutput("");
    setJudgeVerdict(null);
    startTransition(refresh);
  }
  function register(mode: "rated" | "unrated") {
    setError("");
    startTransition(async () => {
      const result = await registerForContest(state.id, mode);
      if (result.error) { setError(result.error); return; }
      await refresh();
    });
  }
  function unregister() {
    setError("");
    startTransition(async () => {
      const result = await unregisterFromContest(state.id);
      if (result.error) { setError(result.error); return; }
      await refresh();
    });
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
    <div>
      {state.phase === "scheduled" ? <RegistrationCard state={state} isPending={isPending} error={error} onRegister={register} onUnregister={unregister} />
      : !state.canParticipate ? <Card><CardContent className="py-12 text-center"><p className="font-semibold">{state.eligible ? "Registration이 마감되었습니다." : `${state.gradeLevel} 대상 대회입니다.`}</p><p className="mt-2 text-sm text-muted-foreground">{state.eligible ? "시작 전에 Register한 참가자만 문제를 제출할 수 있습니다. 리더보드는 계속 볼 수 있습니다." : "프로필 학년과 일치할 때 참가할 수 있어요."}</p></CardContent></Card>
      : state.contestMode === "output_judge" && judgeProblem && state.phase === "active" ? <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><Badge variant="outline"><Code2 className="mr-1 h-3 w-3" />Output Judge</Badge><Badge variant="warning">Level {judgeProblem.difficulty}</Badge></div><div className="flex items-center gap-2"><Badge variant="secondary"><Clock3 className="mr-1 h-3 w-3" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</Badge><span className="text-sm font-semibold">{answeredJudgeCount + 1}/{state.judgeProblems.length}</span></div></div>
          <Progress value={(answeredJudgeCount / Math.max(1, state.judgeProblems.length)) * 100} />
          <CardTitle className="pt-2 text-xl">{judgeProblem.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <section><h3 className="text-sm font-semibold text-muted-foreground">문제</h3><p className="mt-2 whitespace-pre-wrap leading-7">{judgeProblem.statement}</p></section>
          {judgeProblem.constraints && <section><h3 className="text-sm font-semibold text-muted-foreground">제약 조건</h3><p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-sm">{judgeProblem.constraints}</p></section>}
          <section><h3 className="text-sm font-semibold text-muted-foreground">주어진 Input</h3><pre className="mt-2 max-h-64 overflow-auto rounded-lg border bg-zinc-950 p-4 text-sm text-zinc-100">{judgeProblem.fixedInput}</pre></section>
          <section><label htmlFor="contest-output" className="text-sm font-semibold">실행 결과 답안</label><p className="mt-1 text-xs text-muted-foreground">위 Input을 사용해 직접 계산·실행한 출력만 입력하세요. 제출 후에는 수정할 수 없습니다.</p><textarea id="contest-output" value={judgeOutput} onChange={(event) => setJudgeOutput(event.target.value)} disabled={isPending || Boolean(judgeVerdict)} rows={7} maxLength={50_000} spellCheck={false} className="mt-3 w-full rounded-xl border border-border bg-background p-4 font-mono text-sm outline-none focus:border-primary" placeholder="실행 결과를 그대로 입력하세요" /></section>
          {!judgeVerdict && <Button type="button" onClick={submitJudgeOutput} disabled={isPending || !judgeOutput.trim()} className="w-full"><Send className="h-4 w-4" />답안 제출</Button>}
          {isPending && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}
          {judgeVerdict && <div className={`rounded-xl border p-4 ${judgeVerdict === "accepted" ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}><p className="flex items-center gap-2 font-semibold">{judgeVerdict === "accepted" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}{judgeVerdict === "accepted" ? "Accepted · +100점" : "Wrong Answer · 0점"}</p><Button onClick={nextJudgeProblem} disabled={isPending} className="mt-4 w-full">다음 문제</Button></div>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      : !question || state.phase === "finished" ? <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><Trophy className="h-10 w-10 text-warning" /><h2 className="text-xl font-bold">{state.phase === "finished" ? "대회가 종료되었습니다" : "모든 문제를 제출했습니다"}</h2><p className="text-muted-foreground">{state.score}점 · {state.solved}문제 정답</p></CardContent></Card>
      : <Card><CardHeader className="gap-3"><div className="flex items-center justify-between"><div className="flex gap-2"><Badge variant="outline">{question.unitName}</Badge><Badge variant="warning">난이도 {question.difficulty}</Badge></div><div className="flex items-center gap-2"><Badge variant="secondary"><Clock3 className="mr-1 h-3 w-3" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</Badge><span className="text-sm font-semibold">{state.answeredKeys.length + 1}/{state.questions.length}</span></div></div><Progress value={(state.answeredKeys.length / state.questions.length) * 100} /><CardTitle className="whitespace-pre-line pt-2 text-lg leading-relaxed">{question.content}</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">
        {question.choices.map((choice, index) => <Button key={`${choice}-${index}`} variant="outline" disabled={isPending || Boolean(feedback)} onClick={() => answer(choice)} className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left"><span className="mr-3 rounded-full bg-secondary px-2 py-1 text-xs">{index + 1}</span>{choice}</Button>)}
        {isPending && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}{feedback && <div className={`rounded-xl border p-4 ${feedback.correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}><p className="flex items-center gap-2 font-semibold">{feedback.correct ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}{feedback.correct ? "정답! +100점" : `오답 · 정답은 ${feedback.answer}`}</p><p className="mt-2 text-sm text-muted-foreground">{feedback.explanation}</p><Button onClick={next} className="mt-4 w-full">다음 문제</Button></div>}{error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent></Card>}
    </div>
    <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span>{state.phase === "finished" ? "Final Leaderboard" : "실시간 순위표"}</span><span className="flex items-center gap-2">{state.phase === "active" ? <Badge variant="success">LIVE</Badge> : state.phase === "finished" ? <Badge variant="secondary">FINAL</Badge> : null}<Button asChild size="sm" variant="outline"><Link href={`/contests/${state.id}/standings`}><ListOrdered className="h-4 w-4" />자세히 보기</Link></Button></span></CardTitle></CardHeader><CardContent className="flex flex-col gap-1"><div className={`mb-2 grid ${state.phase === "finished" ? "grid-cols-[32px_1fr_50px_56px]" : "grid-cols-[32px_1fr_55px_55px]"} gap-2 text-xs text-muted-foreground`}><span>#</span><span>참가자</span><span>점수</span><span>{state.phase === "finished" ? "Rating" : "페널티"}</span></div>{state.standings.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">아직 참가자가 없어요.</p>}{state.standings.map((row, index) => <div key={row.user_id} className={`grid ${state.phase === "finished" ? "grid-cols-[32px_1fr_50px_56px]" : "grid-cols-[32px_1fr_55px_55px]"} gap-2 rounded-lg px-1 py-2 text-sm`}><strong>{row.final_rank ?? index + 1}</strong><div className="flex min-w-0 items-center gap-1"><RatingName nickname={row.nickname} rating={row.rating} userId={row.user_id} className="truncate" />{row.participation_mode === "unrated" && <span className="text-[9px] text-muted-foreground">U</span>}</div><strong>{row.score}</strong>{state.phase === "finished" ? !row.has_submitted ? <span className="text-[9px] font-semibold text-muted-foreground">No show</span> : row.participation_mode === "unrated" ? <span className="text-[10px] font-semibold text-muted-foreground">Unrated</span> : <span className={`text-xs font-semibold ${(row.rating_change ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>{(row.rating_change ?? 0) >= 0 ? "+" : ""}{row.rating_change ?? 0}</span> : <span className="text-xs text-muted-foreground">{Math.floor(row.penalty_seconds / 60)}분</span>}</div>)}</CardContent></Card>
  </div>;
}

function RegistrationCard({
  state,
  isPending,
  error,
  onRegister,
  onUnregister,
}: {
  state: ContestState;
  isPending: boolean;
  error: string;
  onRegister: (mode: "rated" | "unrated") => void;
  onUnregister: () => void;
}) {
  if (!state.eligible) {
    return <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Clock3 className="h-10 w-10 text-primary" /><h2 className="text-xl font-bold">{state.gradeLevel} 대상 대회</h2><p className="text-sm text-muted-foreground">프로필 학년이 일치하지 않아 Register할 수 없습니다.</p></CardContent></Card>;
  }
  return <Card>
    <CardHeader className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><UserPlus className="h-6 w-6 text-primary" /></div>
      <CardTitle className="mt-2">{state.registrationMode ? "Registration 완료" : "대회에 Register"}</CardTitle>
      <ContestCountdown startsAt={state.startsAt} serverNow={state.serverNow} />
      <p className="text-sm text-muted-foreground">{new Date(state.startsAt).toLocaleString("ko-KR")} 시작 · 시작 전까지 유형을 변경하거나 취소할 수 있습니다.</p>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className={`grid gap-3 ${state.ratedAvailable ? "sm:grid-cols-2" : ""}`}>
        {state.ratedAvailable && <button type="button" disabled={isPending} onClick={() => onRegister("rated")} className={`rounded-xl border p-4 text-left transition hover:border-primary ${state.registrationMode === "rated" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
          <div className="flex items-center justify-between"><strong className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Rated</strong>{state.registrationMode === "rated" && <Badge variant="success">REGISTERED</Badge>}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">공식 순위에 참여하며 종료 후 성적에 따라 Rating이 변합니다.</p>
        </button>}
        <button type="button" disabled={isPending} onClick={() => onRegister("unrated")} className={`rounded-xl border p-4 text-left transition hover:border-primary ${state.registrationMode === "unrated" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
          <div className="flex items-center justify-between"><strong>Unrated</strong>{state.registrationMode === "unrated" && <Badge variant="secondary">REGISTERED</Badge>}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">같은 문제와 리더보드에 참여하지만 Rating은 변하지 않습니다.</p>
        </button>
      </div>
      {isPending && <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />}
      {state.registrationMode && <Button type="button" variant="outline" disabled={isPending} onClick={onUnregister}>Unregister</Button>}
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>;
}

function ContestCountdown({ startsAt, serverNow }: { startsAt: string; serverNow: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(startsAt).getTime() - new Date(serverNow).getTime()));
  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const tick = () => setRemaining(Math.max(0, new Date(startsAt).getTime() - (Date.now() + offset)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [serverNow, startsAt]);
  const totalSeconds = Math.ceil(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-5">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Before the contest</p>
    <div className="mt-3 flex items-center justify-center gap-2 font-mono text-2xl font-bold tabular-nums sm:text-3xl">
      <TimeUnit value={days} label="DAY" /><span>:</span><TimeUnit value={hours} label="HOUR" /><span>:</span><TimeUnit value={minutes} label="MIN" /><span>:</span><TimeUnit value={seconds} label="SEC" />
    </div>
  </div>;
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return <span className="min-w-10"><span>{String(value).padStart(2, "0")}</span><span className="mt-1 block text-[8px] font-medium tracking-wider text-muted-foreground">{label}</span></span>;
}
