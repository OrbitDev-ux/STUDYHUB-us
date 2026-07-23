import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Save, Swords } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { updateDeveloperContest } from "../../../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Edit Contest" };

export default async function EditDeveloperContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { admin } = await requireDeveloper();
  const { data: contest } = await admin.from("contests").select("*").eq("id", id).maybeSingle();
  if (!contest) notFound();
  const started = new Date(contest.starts_at).getTime() <= Date.now();
  const isCoding = contest.contest_mode === "output_judge";
  const selected = new Set<string>(isCoding
    ? Array.isArray(contest.judge_problem_ids) ? contest.judge_problem_ids : []
    : Array.isArray(contest.question_keys)
      ? contest.question_keys
        .filter((key: unknown): key is string => typeof key === "string" && key.startsWith("db:"))
        .map((key: string) => key.slice(3))
      : []);
  const problemResult = isCoding
    ? await admin.from("oj_problems")
      .select("id,title,difficulty,grade_level,status")
      .or(`grade_level.is.null,grade_level.eq.${contest.grade_level}`)
      .order("status").order("created_at", { ascending: false })
    : await admin.from("questions")
      .select("id,content,difficulty,grade_level,subject_id,status")
      .eq("grade_level", contest.grade_level).eq("subject_id", contest.subject_id)
      .order("status").order("created_at", { ascending: false });
  const duration = Math.max(5, Math.round((new Date(contest.ends_at).getTime() - new Date(contest.starts_at).getTime()) / 60_000));

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><Button asChild variant="ghost" size="sm" className="-ml-3 mb-2"><Link href="/developer/contests"><ArrowLeft className="h-4 w-4" />대회 관리</Link></Button><h1 className="flex items-center gap-2 text-2xl font-bold"><Swords className="h-6 w-6 text-emerald-400" />Edit Contest</h1><p className="mt-1 text-sm text-zinc-400">예정 대회의 기본 정보와 문제 구성을 한 화면에서 검수합니다.</p></div>
      <div className="flex gap-2"><Badge variant="outline">{isCoding ? "OUTPUT JUDGE" : "QUIZ"}</Badge><Badge variant={started ? "secondary" : "warning"}>{started ? "EDIT CLOSED" : "SCHEDULED"}</Badge></div>
    </div>
    {started ? <Card className="border-amber-900 bg-amber-950/20 text-amber-100"><CardContent className="py-10 text-center">이미 시작한 대회는 공정성을 위해 수정할 수 없습니다.</CardContent></Card>
      : <form action={updateDeveloperContest} className="flex flex-col gap-5">
        <input type="hidden" name="contest_id" value={contest.id} />
        <input type="hidden" name="problem_selection" value="1" />
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-base">기본 정보</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="대회명"><Input name="title" defaultValue={contest.title} required minLength={2} maxLength={100} className={inputClass} /></Field>
            <Field label="시작 시각"><Input name="starts_at" type="datetime-local" defaultValue={toDateTimeLocal(contest.starts_at)} required className={inputClass} /></Field>
            <Field label="진행 시간(분)"><Input name="duration_minutes" type="number" min={5} max={360} defaultValue={duration} required className={inputClass} /></Field>
            <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" name="is_rated" defaultChecked={contest.is_rated} />Rated 등록 허용</label>
            <label className="text-xs text-zinc-400 sm:col-span-2">설명<textarea name="description" defaultValue={contest.description} rows={4} maxLength={2000} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100" /></label>
            <p className="flex items-center gap-1 text-xs text-zinc-500 sm:col-span-2"><CalendarClock className="h-3.5 w-3.5" />시작 전까지만 수정할 수 있으며 저장 즉시 사용자 화면과 카운트다운에 반영됩니다.</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader><CardTitle className="text-base">{isCoding ? "고정 Input 코딩 문제" : "Quiz 문제"} 선택</CardTitle><p className="text-xs text-zinc-500">{isCoding ? "1~16개" : "5~16개"}의 Published 문제를 선택하세요. 현재 선택 {selected.size}개</p></CardHeader>
          <CardContent className="max-h-[34rem] space-y-2 overflow-y-auto">
            {problemResult.error && <p className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">문제 목록을 불러오지 못했습니다.</p>}
            {(problemResult.data ?? []).map((problem) => {
              const title = isCoding && "title" in problem ? problem.title : "content" in problem ? problem.content : "문제";
              const published = problem.status === "published";
              return <label key={problem.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${published ? "border-zinc-800 hover:border-emerald-700" : "border-zinc-900 opacity-50"}`}>
                <input type="checkbox" name={isCoding ? "judge_problem_id" : "question_id"} value={problem.id} defaultChecked={selected.has(problem.id)} disabled={!published} className="mt-1" />
                <span className="min-w-0"><strong className="line-clamp-2 text-sm">{title}</strong><span className="mt-1 block text-[11px] text-zinc-500">Level {problem.difficulty} · {problem.status}{selected.has(problem.id) ? " · 현재 대회 문제" : ""}</span></span>
              </label>;
            })}
          </CardContent>
        </Card>
        <Button type="submit" className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"><Save className="h-4 w-4" />대회 전체 수정 저장</Button>
      </form>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs text-zinc-400">{label}<span className="mt-2 block">{children}</span></label>;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const inputClass = "border-zinc-700 bg-zinc-950";
