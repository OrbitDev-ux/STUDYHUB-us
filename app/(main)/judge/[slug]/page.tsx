import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Code2, FlaskConical } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { VERDICT_LABEL, verdictClass } from "@/lib/online-judge/presentation";
import type { JudgeVerdict } from "@/lib/online-judge/types";
import { JudgeEditor } from "@/components/online-judge/judge-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SubmissionRow = {
  id: string;
  language: string | null;
  verdict: JudgeVerdict;
  score: number;
  passed_count: number;
  test_count: number;
  max_time_ms: number | null;
  max_memory_kb: number | null;
  created_at: string;
};

export default async function JudgeProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: problem } = await supabase.from("oj_problems").select("*").eq("slug", slug).eq("status", "published").single();
  if (!problem) notFound();
  const admin = createAdminClient();
  const [{ data: fixedCase }, { data: submissions }] = await Promise.all([
    admin.from("oj_test_cases").select("input,order_index").eq("problem_id", problem.id).order("order_index").limit(1).maybeSingle(),
    supabase.from("oj_submissions").select("id,language,verdict,score,passed_count,test_count,max_time_ms,max_memory_kb,created_at")
      .eq("problem_id", problem.id).order("created_at", { ascending: false }).limit(10),
  ]);

  return <div className="flex flex-col gap-6">
    <div><Link href="/judge" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />문제 목록</Link><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{problem.title}</h1><Badge variant="outline">Lv.{problem.difficulty}</Badge>{problem.grade_level && <Badge variant="secondary">{problem.grade_level}</Badge>}</div><div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Code2 className="h-3.5 w-3.5" />고정 Input · Output Answer 방식</span><span>실행 결과 답안만 제출</span></div></div>
    <Card><CardContent className="space-y-6 py-6">
      <Section title="문제"><p className="whitespace-pre-wrap leading-7">{problem.statement}</p></Section>
      <Section title="입력"><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{problem.input_description || "입력이 없습니다."}</p></Section>
      <Section title="출력"><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{problem.output_description}</p></Section>
      {problem.constraints_text && <Section title="제한"><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{problem.constraints_text}</p></Section>}
      <Section title="주어지는 고정 Input">
        {fixedCase ? <Sample title="이 입력에 대한 프로그램 출력값을 제출하세요" value={fixedCase.input} /> : <p className="text-sm text-destructive">고정 입력이 설정되지 않았습니다.</p>}
      </Section>
    </CardContent></Card>
    <JudgeEditor problemId={problem.id} />
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4" />이 문제의 내 제출</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!(submissions ?? []).length && <p className="py-8 text-center text-sm text-muted-foreground">아직 제출 기록이 없습니다.</p>}
        {((submissions ?? []) as SubmissionRow[]).map((submission) => <div key={submission.id} className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div><strong className={verdictClass(submission.verdict)}>{VERDICT_LABEL[submission.verdict]}</strong><p className="text-xs text-muted-foreground">Output Answer · {new Date(submission.created_at).toLocaleString("ko-KR")}</p></div>
          <span>{submission.score}점 · {submission.passed_count}/{submission.test_count}</span>
          <span className="text-xs text-muted-foreground">{submission.max_time_ms ?? "-"} ms · {submission.max_memory_kb ?? "-"} KB</span>
        </div>)}
      </CardContent>
    </Card>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 text-lg font-bold">{title}</h2>{children}</section>;
}

function Sample({ title, value }: { title: string; value: string }) {
  return <div><p className="mb-2 text-sm font-semibold">{title}</p><pre className="min-h-16 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-sm text-zinc-100">{value}</pre></div>;
}
