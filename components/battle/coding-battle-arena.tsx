"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  Loader2,
  Search,
  Shield,
  Swords,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  cancelCodingBattle,
  getCodingBattleState,
  joinCodingBattle,
  submitCodingBattleOutput,
  type CodingBattleState,
} from "@/app/(main)/battle/code/actions";
import { createClient } from "@/lib/supabase/client";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CodingBattleArena({
  gradeLevel,
  rating,
  initialMatchId = null,
}: {
  gradeLevel: string;
  rating: number;
  initialMatchId?: string | null;
}) {
  const router = useRouter();
  const [matchId, setMatchId] = useState(initialMatchId);
  const [battle, setBattle] = useState<CodingBattleState | null>(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [verdict, setVerdict] = useState<"accepted" | "wrong_answer" | null>(null);
  const [remaining, setRemaining] = useState(600);
  const [isPending, startTransition] = useTransition();
  const requestedId = useRef(initialMatchId);
  const startedAt = useRef(Date.now());

  const refresh = useCallback(async (id: string) => {
    const result = await getCodingBattleState(id);
    if (requestedId.current !== id) return;
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.state) {
      setBattle(result.state);
      setError("");
    }
  }, []);

  useEffect(() => {
    if (!initialMatchId) return;
    requestedId.current = initialMatchId;
    setMatchId(initialMatchId);
    setBattle((current) => current?.id === initialMatchId ? current : null);
    setVerdict(null);
    setOutput("");
    void refresh(initialMatchId);
  }, [initialMatchId, refresh]);

  useEffect(() => {
    if (!matchId || battle?.status === "completed" || battle?.status === "cancelled") return;
    const supabase = createClient();
    const channel = supabase.channel(`coding-battle:${matchId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "coding_battle_matches",
        filter: `id=eq.${matchId}`,
      }, () => void refresh(matchId))
      .subscribe();
    const fallback = window.setInterval(() => void refresh(matchId), 4000);
    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [matchId, battle?.status, refresh]);

  useEffect(() => {
    if (battle?.status === "active") startedAt.current = Date.now();
  }, [battle?.id, battle?.status]);

  useEffect(() => {
    if (battle?.status !== "active") return;
    const update = () => setRemaining(Math.max(
      0,
      Math.ceil((new Date(battle.expiresAt).getTime() - Date.now()) / 1000),
    ));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [battle?.expiresAt, battle?.status]);

  useEffect(() => {
    if (battle?.status === "completed") router.refresh();
  }, [battle?.status, router]);

  function start() {
    setError("");
    setVerdict(null);
    setOutput("");
    startTransition(async () => {
      const result = await joinCodingBattle();
      if (result.error || !result.matchId) {
        setError(result.error ?? "매칭을 시작하지 못했습니다.");
        return;
      }
      requestedId.current = result.matchId;
      setMatchId(result.matchId);
      router.replace(`/battle/code?match=${result.matchId}`);
      await refresh(result.matchId);
    });
  }

  function submit() {
    if (!battle || battle.status !== "active" || battle.submitted || !output.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await submitCodingBattleOutput(
        battle.id,
        output,
        Date.now() - startedAt.current,
      );
      if (result.error || !result.verdict) {
        setError(result.error ?? "답안을 제출하지 못했습니다.");
        await refresh(battle.id);
        return;
      }
      setVerdict(result.verdict);
      await refresh(battle.id);
    });
  }

  function reset() {
    requestedId.current = null;
    setMatchId(null);
    setBattle(null);
    setOutput("");
    setVerdict(null);
    setError("");
    router.replace("/battle/code");
  }

  if (!battle && initialMatchId) {
    return <Card><CardContent className="flex flex-col items-center gap-4 py-16">
      <Loader2 className="h-9 w-9 animate-spin text-emerald-500" />
      <p className="font-semibold">코딩 배틀방에 입장하고 있습니다.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>;
  }

  if (!battle) {
    return <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5 text-emerald-500" />고정 Input 매칭</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Rule icon={Shield} title="서버 정답 보호">정답 Output은 브라우저로 전송되지 않습니다.</Rule>
          <Rule icon={CheckCircle2} title="한 번만 제출">첫 출력 답안의 정오로 승부합니다.</Rule>
          <Rule icon={Clock3} title="정답자는 속도 승부">둘 다 정답이면 더 빨리 제출한 사용자가 이깁니다.</Rule>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4 text-sm">
          <span><strong>{gradeLevel}</strong> 공개 Judge 문제로 자동 매칭</span>
          <span>내 ELO <strong>{rating}</strong></span>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="lg" onClick={start} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          같은 학년 상대 찾기
        </Button>
      </CardContent>
    </Card>;
  }

  if (battle.status === "waiting") {
    return <Card><CardContent className="flex flex-col items-center gap-5 py-16 text-center">
      <div className="relative"><Code2 className="h-12 w-12 text-emerald-500" /><span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-emerald-500" /></div>
      <div><h2 className="text-xl font-bold">Output Judge 상대를 찾고 있어요</h2><p className="mt-1 text-sm text-muted-foreground">{battle.gradeLevel} 대기열 · 상대가 입장하면 동일한 문제가 공개됩니다.</p></div>
      <Button variant="outline" onClick={() => startTransition(async () => {
        await cancelCodingBattle(battle.id);
        reset();
      })}>매칭 취소</Button>
    </CardContent></Card>;
  }

  if (battle.status === "cancelled") {
    return <Card><CardContent className="flex flex-col items-center gap-4 py-14">
      <p className="font-semibold">종료되거나 취소된 코딩 배틀입니다.</p>
      <Button onClick={reset}>새 코딩 배틀</Button>
    </CardContent></Card>;
  }

  if (!battle.problem) {
    return <Card><CardContent className="flex flex-col items-center gap-4 py-14">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      <p className="font-semibold">동일한 배틀 문제를 준비하고 있습니다.</p>
    </CardContent></Card>;
  }

  if (battle.status === "completed") {
    const delta = (battle.myRatingAfter ?? battle.myRatingBefore) - battle.myRatingBefore;
    return <Card><CardContent className="flex flex-col items-center gap-5 py-10 text-center">
      <div className={`flex h-20 w-20 items-center justify-center rounded-full ${battle.winner === "me" ? "bg-warning/20" : "bg-secondary"}`}>
        {battle.winner === "me" ? <Trophy className="h-10 w-10 text-warning" /> : <Swords className="h-10 w-10 text-muted-foreground" />}
      </div>
      <div>
        <h2 className="text-2xl font-bold">{battle.winner === "me" ? "승리!" : battle.winner === "draw" ? "무승부" : "패배"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{battle.problem.title}</p>
      </div>
      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        <ResultBox label="나" correct={battle.correct} responseMs={battle.responseMs} />
        <ResultBox label={battle.opponent?.nickname ?? "상대"} correct={battle.opponentCorrect} responseMs={battle.opponentResponseMs} />
      </div>
      <div className="w-full max-w-xl rounded-xl border border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">Codeforces Rating</p>
        <p className="mt-1 text-2xl font-bold">{battle.myRatingAfter ?? battle.myRatingBefore} <span className={`text-sm ${delta >= 0 ? "text-success" : "text-destructive"}`}>{delta >= 0 ? "+" : ""}{delta}</span></p>
        <div className="mt-2"><RatingBadge rating={battle.myRatingAfter ?? battle.myRatingBefore} /></div>
      </div>
      <Button onClick={reset}><Code2 className="h-4 w-4" />다시 배틀하기</Button>
    </CardContent></Card>;
  }

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2"><Badge variant="outline">Level {battle.problem.difficulty}</Badge><Badge variant="success">OUTPUT ONLY</Badge></div>
          <Badge variant={remaining <= 60 ? "warning" : "secondary"}><Clock3 className="mr-1 h-3 w-3" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</Badge>
        </div>
        <CardTitle>{battle.problem.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section><h3 className="mb-2 text-sm font-semibold">문제</h3><p className="whitespace-pre-wrap text-sm leading-7">{battle.problem.statement}</p></section>
        {battle.problem.constraints && <section><h3 className="mb-2 text-sm font-semibold">제한</h3><pre className="whitespace-pre-wrap rounded-xl bg-secondary p-4 text-xs">{battle.problem.constraints}</pre></section>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Info title="입력 설명" value={battle.problem.inputDescription} />
          <Info title="출력 설명" value={battle.problem.outputDescription} />
        </div>
        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">고정 Input</h3><Button type="button" size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(battle.problem?.fixedInput ?? "")}><Copy className="h-4 w-4" />복사</Button></div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-zinc-950 p-4 font-mono text-sm text-zinc-100">{battle.problem.fixedInput}</pre>
        </section>
      </CardContent>
    </Card>

    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader><CardTitle className="text-base">1:1 현황</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between"><strong>나</strong><Badge variant={battle.submitted ? "success" : "secondary"}>{battle.submitted ? "제출 완료" : "풀이 중"}</Badge></div>
          <div className="flex items-center justify-between"><RatingName nickname={battle.opponent?.nickname ?? "상대"} rating={battle.opponentRatingBefore ?? 1200} userId={battle.opponent?.id} /><Badge variant={battle.opponentSubmitted ? "success" : "secondary"}>{battle.opponentSubmitted ? "제출 완료" : "풀이 중"}</Badge></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">실행 결과 답안 제출</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs leading-5 text-muted-foreground">코드는 제출하지 않습니다. 고정 Input에 대한 프로그램의 최종 출력만 정확히 붙여 넣으세요. 제출 기회는 1회입니다.</p>
          <textarea
            value={output}
            onChange={(event) => setOutput(event.target.value)}
            disabled={battle.submitted || isPending}
            rows={10}
            maxLength={50_000}
            spellCheck={false}
            placeholder="실행 결과 Output"
            className="w-full resize-y rounded-xl border border-input bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          <Button onClick={submit} disabled={battle.submitted || isPending || !output.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
            {battle.submitted ? "제출 완료" : "Output 제출"}
          </Button>
          {(verdict || battle.submitted) && <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${(verdict ?? (battle.correct ? "accepted" : "wrong_answer")) === "accepted" ? "border-success/40 bg-success/5 text-success" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
            {(verdict ?? (battle.correct ? "accepted" : "wrong_answer")) === "accepted" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
            <span>{(verdict ?? (battle.correct ? "accepted" : "wrong_answer")) === "accepted" ? "Accepted · 상대 결과를 기다립니다." : "Wrong Answer · 상대 결과를 기다립니다."}</span>
          </div>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  </div>;
}

function Rule({ icon: Icon, title, children }: { icon: typeof Shield; title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border p-4"><Icon className="h-5 w-5 text-emerald-500" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{children}</p></div>;
}

function Info({ title, value }: { title: string; value: string }) {
  return <section><h3 className="mb-2 text-sm font-semibold">{title}</h3><p className="min-h-20 whitespace-pre-wrap rounded-xl bg-secondary p-4 text-sm">{value || "-"}</p></section>;
}

function ResultBox({ label, correct, responseMs }: { label: string; correct: boolean | null; responseMs: number | null }) {
  return <div className={`rounded-xl border p-4 text-left ${correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`mt-1 font-bold ${correct ? "text-success" : "text-destructive"}`}>{correct ? "Accepted" : "Wrong Answer / 미제출"}</p>
    <p className="mt-1 text-xs text-muted-foreground">{responseMs === null ? "-" : `${(responseMs / 1000).toFixed(2)}초`}</p>
  </div>;
}
