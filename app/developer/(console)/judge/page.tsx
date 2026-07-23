import Link from "next/link";
import { Archive, CheckCircle2, Code2, FileInput, FlaskConical, Pencil, Plus, RotateCcw } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { saveJudgeProblem, setJudgeProblemStatus } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GRADES = ["", "초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3"];
const ERRORS: Record<string, string> = {
  invalid_problem: "문제, 고정 Input과 정답 Output 입력값을 확인해주세요.",
  duplicate_slug: "이미 사용 중인 URL slug입니다.",
  save_failed: "온라인 저지 문제를 저장하지 못했습니다.",
};

type ProblemRow = {
  id: string;
  slug: string;
  title: string;
  difficulty: number;
  status: "draft" | "published" | "archived";
  submission_count: number;
  accepted_count: number;
  updated_at: string;
};

type EditingProblem = ProblemRow & {
  statement: string;
  input_description: string;
  output_description: string;
  constraints_text: string;
  grade_level: string | null;
};

export default async function DeveloperJudgePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; updated?: string; saved?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const { admin } = await requireDeveloper();
  const { data, error } = await admin.from("oj_problems")
    .select("id,slug,title,difficulty,status,submission_count,accepted_count,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  const schemaReady = !error || !isMissingSchemaError(error);
  const problems = (data ?? []) as unknown as ProblemRow[];
  const editingId = /^[0-9a-f-]{36}$/i.test(params.edit ?? "") ? params.edit! : null;
  const [{ data: editingData }, { data: fixedCase }] = schemaReady && editingId
    ? await Promise.all([
      admin.from("oj_problems")
        .select("id,slug,title,statement,input_description,output_description,constraints_text,grade_level,difficulty,status,submission_count,accepted_count,updated_at")
        .eq("id", editingId)
        .maybeSingle(),
      admin.from("oj_test_cases").select("input,expected_output").eq("problem_id", editingId).eq("order_index", 0).maybeSingle(),
    ])
    : [{ data: null }, { data: null }];
  const editing = editingData as EditingProblem | null;

  return <div className="flex flex-col gap-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Code2 className="h-6 w-6 text-emerald-400" />Output Judge Studio</h1><p className="mt-1 text-sm text-zinc-400">사용자에게 공개할 고정 Input과 서버에서만 보관할 정답 Output을 관리합니다.</p></div>
    {params.error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{ERRORS[params.error] ?? "작업을 완료하지 못했습니다."}</p>}
    {(params.created || params.updated || params.saved) && <p className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">{params.created ? "고정 Input 방식의 저지 문제를 생성했습니다." : params.saved ? "문제와 고정 Input·정답 Output을 수정했습니다." : "문제 공개 상태를 변경했습니다."}</p>}
    {!schemaReady && <Card className="border-amber-900 bg-amber-950/30 text-amber-200"><CardContent className="py-5 text-sm"><strong>DB migration required</strong><p className="mt-1 text-xs opacity-75">Supabase SQL Editor에서 `0029_online_judge.sql`과 `0030_output_only_judge.sql`을 순서대로 적용해주세요.</p></CardContent></Card>}

    {schemaReady && <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{editing ? "고정 Input 문제 수정" : "새 고정 Input 문제 출제"}</CardTitle>
        {editing && <Button asChild size="sm" variant="outline"><Link href="/developer/judge"><Plus className="h-4 w-4" />새 문제</Link></Button>}
      </CardHeader>
      <CardContent>
        <form action={saveJudgeProblem} className="grid gap-4 sm:grid-cols-2">
          {editing && <input type="hidden" name="problem_id" value={editing.id} />}
          <Field label="문제 제목"><Input name="title" defaultValue={editing?.title} required minLength={2} maxLength={120} className={inputClass} placeholder="예: 두 수의 합" /></Field>
          <Field label="URL slug"><Input name="slug" defaultValue={editing?.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={inputClass} placeholder="예: sum-two-numbers" /></Field>
          <Field label="대상 학년"><select name="grade_level" defaultValue={editing?.grade_level ?? ""} className={selectClass}>{GRADES.map((grade) => <option key={grade || "all"} value={grade}>{grade || "전체"}</option>)}</select></Field>
          <Field label="난이도"><select name="difficulty" defaultValue={editing?.difficulty ?? 1} className={selectClass}>{[1,2,3,4,5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></Field>
          <TextField label="문제 설명" name="statement" rows={7} required defaultValue={editing?.statement} />
          <TextField label="제한 및 조건" name="constraints_text" rows={7} defaultValue={editing?.constraints_text} />
          <TextField label="입력 설명" name="input_description" rows={4} required defaultValue={editing?.input_description} />
          <TextField label="출력 설명" name="output_description" rows={4} required defaultValue={editing?.output_description} />
          <TextField label="사용자에게 주어지는 고정 Input" name="fixed_input" rows={10} required defaultValue={fixedCase?.input} />
          <TextField label="서버 전용 정답 Output" name="expected_output" rows={10} required defaultValue={fixedCase?.expected_output} />
          <div className="flex items-start gap-2 rounded-xl border border-amber-900 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200 sm:col-span-2"><FileInput className="mt-0.5 h-4 w-4 shrink-0" /><p>정답 Output은 일반 사용자에게 전송되지 않습니다. 사용자는 공개된 고정 Input을 풀어 얻은 출력 결과만 제출합니다.</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish_now" defaultChecked={editing?.status === "published"} />저장 즉시 공개</label>
          <Button type="submit" className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"><FlaskConical className="h-4 w-4" />{editing ? "문제·정답 저장" : "문제·테스트 생성"}</Button>
        </form>
      </CardContent>
    </Card>}

    {schemaReady && <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="text-base">Judge Problems</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!problems.length && <p className="py-10 text-center text-sm text-zinc-500">등록된 문제가 없습니다.</p>}
        {problems.map((problem) => <div key={problem.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div><div className="flex flex-wrap items-center gap-2"><Badge variant={problem.status === "published" ? "success" : "secondary"}>{problem.status}</Badge><Badge variant="outline">Lv.{problem.difficulty}</Badge><Link href={`/judge/${problem.slug}`} className="font-semibold hover:text-emerald-300 hover:underline">{problem.title}</Link></div><p className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500"><span>Fixed Input → Output Answer</span><span>{problem.accepted_count}/{problem.submission_count} Accepted</span></p></div>
          <div className="flex gap-1">
            <Button asChild type="button" size="sm" variant="outline" title="문제와 정답 수정"><Link href={`/developer/judge?edit=${problem.id}`}><Pencil className="h-4 w-4" /></Link></Button>
            {problem.status !== "published" && <form action={setJudgeProblemStatus.bind(null, problem.id, "published")}><Button type="submit" size="sm" variant="outline" title="공개"><CheckCircle2 className="h-4 w-4 text-emerald-400" /></Button></form>}
            {problem.status !== "archived" ? <form action={setJudgeProblemStatus.bind(null, problem.id, "archived")}><Button type="submit" size="sm" variant="outline" title="보관"><Archive className="h-4 w-4" /></Button></form> : <form action={setJudgeProblemStatus.bind(null, problem.id, "draft")}><Button type="submit" size="sm" variant="outline" title="초안 복원"><RotateCcw className="h-4 w-4" /></Button></form>}
          </div>
        </div>)}
      </CardContent>
    </Card>}
  </div>;
}

const inputClass = "border-zinc-700 bg-zinc-950";
const selectClass = "h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm";
const textareaClass = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div>;
}

function TextField({ label, name, rows, required = false, defaultValue }: { label: string; name: string; rows: number; required?: boolean; defaultValue?: string }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label><textarea name={name} rows={rows} required={required} defaultValue={defaultValue} maxLength={50_000} className={textareaClass} /></div>;
}
