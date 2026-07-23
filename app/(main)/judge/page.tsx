import Link from "next/link";
import { Calculator, Code2, FileInput, History, Send, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { VERDICT_LABEL, verdictClass } from "@/lib/online-judge/presentation";
import type { JudgeVerdict } from "@/lib/online-judge/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Online Judge" };

type ProblemRow = {
  id: string;
  slug: string;
  title: string;
  difficulty: number;
  grade_level: string | null;
  submission_count: number;
  accepted_count: number;
};

type SubmissionRow = {
  id: string;
  language: string | null;
  verdict: JudgeVerdict;
  score: number;
  passed_count: number;
  test_count: number;
  created_at: string;
  oj_problems: { title: string; slug: string } | Array<{ title: string; slug: string }> | null;
};

export default async function JudgePage() {
  const supabase = await createClient();
  const [{ data: problems, error }, { data: submissions }, outputModeProbe] = await Promise.all([
    supabase.from("oj_problems")
      .select("id,slug,title,difficulty,grade_level,submission_count,accepted_count")
      .eq("status", "published")
      .order("difficulty")
      .order("created_at"),
    supabase.from("oj_submissions")
      .select("id,language,verdict,score,passed_count,test_count,created_at,oj_problems(title,slug)")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("oj_submissions").select("id,submitted_output").limit(1),
  ]);
  const schemaReady = (!error || !isMissingSchemaError(error))
    && (!outputModeProbe.error || !isMissingSchemaError(outputModeProbe.error));

  return <div className="flex flex-col gap-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Code2 className="h-6 w-6 text-primary" />Output Judge</h1><p className="mt-1 text-sm text-muted-foreground">주어진 고정 Input으로 코드를 작성·실행한 뒤 프로그램의 Output 답안을 제출하세요.</p></div>
    {!schemaReady && <Card className="border-warning/40 bg-warning/5"><CardContent className="py-5 text-sm text-warning"><strong>Output Judge DB 설정이 필요합니다.</strong><p className="mt-1 opacity-80">Supabase에 `0029_online_judge.sql`과 `0030_output_only_judge.sql`을 순서대로 적용해주세요.</p></CardContent></Card>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Feature icon={FileInput} title="고정 Input" description="모든 사용자에게 동일한 입력 데이터가 문제와 함께 주어집니다." />
      <Feature icon={Calculator} title="자유로운 풀이" description="원하는 도구나 개발 환경에서 고정 Input에 대한 결과를 계산합니다." />
      <Feature icon={Send} title="Output 제출" description="코드를 실행해 얻은 최종 출력 답안만 서버에서 정답과 비교합니다." />
    </div>
    <Card>
      <CardHeader><CardTitle className="text-base">문제 목록</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {schemaReady && !(problems ?? []).length && <p className="py-10 text-center text-sm text-muted-foreground">공개된 온라인 저지 문제가 없습니다.</p>}
        {((problems ?? []) as ProblemRow[]).map((problem) => {
          const acceptance = problem.submission_count ? Math.round(problem.accepted_count / problem.submission_count * 100) : 0;
          return <Link key={problem.id} href={`/judge/${problem.slug}`} className="grid gap-3 rounded-xl border border-border p-4 transition hover:border-primary hover:bg-accent/30 sm:grid-cols-[1fr_auto] sm:items-center">
            <div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Lv.{problem.difficulty}</Badge><h2 className="font-semibold">{problem.title}</h2>{problem.grade_level && <span className="text-xs text-muted-foreground">{problem.grade_level}</span>}</div><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Output 답안만 제출·판정</p></div>
            <div className="text-left text-xs text-muted-foreground sm:text-right"><strong className="text-foreground">{acceptance}%</strong><p>{problem.accepted_count} / {problem.submission_count} Accepted</p></div>
          </Link>;
        })}
      </CardContent>
    </Card>
    {schemaReady && <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />내 최근 제출</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!(submissions ?? []).length && <p className="py-8 text-center text-sm text-muted-foreground">아직 제출 기록이 없습니다.</p>}
        {((submissions ?? []) as unknown as SubmissionRow[]).map((submission) => {
          const problem = Array.isArray(submission.oj_problems) ? submission.oj_problems[0] : submission.oj_problems;
          return <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
            <div>{problem ? <Link href={`/judge/${problem.slug}`} className="font-semibold hover:underline">{problem.title}</Link> : <strong>삭제된 문제</strong>}<p className="mt-1 text-xs text-muted-foreground">Output Answer · {new Date(submission.created_at).toLocaleString("ko-KR")}</p></div>
            <div className="text-right"><p className={`font-bold ${verdictClass(submission.verdict)}`}>{VERDICT_LABEL[submission.verdict]}</p><p className="text-xs text-muted-foreground">{submission.score}점 · {submission.passed_count}/{submission.test_count}</p></div>
          </div>;
        })}
      </CardContent>
    </Card>}
  </div>;
}

function Feature({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return <Card><CardContent className="p-4"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></CardContent></Card>;
}
