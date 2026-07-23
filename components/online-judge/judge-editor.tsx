"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VERDICT_LABEL, verdictClass } from "@/lib/online-judge/presentation";
import type { JudgeRunResult } from "@/lib/online-judge/types";

type ApiResponse = { submissionId?: string; result?: JudgeRunResult; error?: string };

export function JudgeEditor({ problemId }: { problemId: string }) {
  const router = useRouter();
  const [submittedOutput, setSubmittedOutput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<JudgeRunResult | null>(null);

  async function submit() {
    if (submitting || !submittedOutput.trim()) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/judge/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the final output answer is submitted.
        body: JSON.stringify({ problemId, submittedOutput }),
      });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.result) {
        setError(payload.error ?? "답안을 처리하지 못했습니다.");
      } else {
        setResult(payload.result);
      }
      router.refresh();
    } catch {
      setError("답안 서버와 통신하지 못했습니다. 네트워크 상태를 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="flex flex-col gap-4">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Send className="h-5 w-5 text-primary" />실행 결과 답안 제출</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">주어진 고정 Input을 풀어 얻은 최종 Output만 그대로 입력하세요.</p>
        <textarea
          value={submittedOutput}
          onChange={(event) => setSubmittedOutput(event.target.value.slice(0, 50_000))}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          rows={7}
          spellCheck={false}
          aria-label="출력 답안"
          placeholder={"예:\n3"}
          className="w-full resize-y rounded-xl border border-input bg-background p-4 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Output 답안만 제출 · Ctrl/⌘ + Enter</span>
          <Button type="button" onClick={() => void submit()} disabled={submitting || !submittedOutput.trim()} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "답안 판정 중..." : "출력 답안 제출"}
          </Button>
        </div>
        {error && <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>

    {result && <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        {result.verdict === "accepted" ? <CheckCircle2 className="h-12 w-12 text-success" /> : <XCircle className="h-12 w-12 text-destructive" />}
        <h2 className={`text-2xl font-bold ${verdictClass(result.verdict)}`}>{VERDICT_LABEL[result.verdict]}</h2>
        <p className="text-sm text-muted-foreground">{result.verdict === "accepted" ? "고정 입력에 대한 출력이 정답과 일치합니다." : "출력값, 줄바꿈과 계산 과정을 다시 확인해주세요."}</p>
        <strong>{result.score}점</strong>
      </CardContent>
    </Card>}
  </div>;
}
