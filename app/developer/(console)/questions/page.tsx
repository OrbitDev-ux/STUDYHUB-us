import Link from "next/link";
import { Archive, CheckCircle2, FileQuestion, Pencil, Plus, RotateCcw } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { GRADE_LEVELS } from "@/lib/practice/question-bank";
import { saveDeveloperQuestion, setDeveloperQuestionStatus } from "../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isMissingSchemaError } from "@/lib/developer/schema-status";

export const metadata = { title: "Developer Questions" };

type QuestionRow = {
  id: string; subject_id: string; grade_level: string | null; unit_name: string | null;
  difficulty: number; content: string; choices: string[] | null; answer: string;
  explanation: string | null; status: "draft" | "published" | "archived"; source: string; updated_at: string;
};

type LegacyQuestionRow = {
  id: string; subject_id: string; difficulty: number; content: string; choices: string[] | null;
  answer: string; explanation: string | null; source: string; created_at: string;
  units: { name: string; grade_level: string | null } | Array<{ name: string; grade_level: string | null }> | null;
};

const ERRORS: Record<string, string> = {
  invalid_question: "문제 입력값을 확인해주세요. 정답은 보기 중 하나와 정확히 일치해야 합니다.",
  invalid_question_id: "잘못된 문제 ID입니다.",
  question_save_failed: "문제를 저장하지 못했습니다.",
  question_status_failed: "문제 공개 상태를 변경하지 못했습니다.",
};

export default async function DeveloperQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; q?: string; status?: string; saved?: string; updated?: string; error?: string; compat?: string }>;
}) {
  const { admin } = await requireDeveloper();
  const params = await searchParams;
  const queryText = (params.q ?? "").trim().slice(0, 60);
  const status = ["draft", "published", "archived"].includes(params.status ?? "") ? params.status! : "";
  let query = admin.from("questions").select("id, subject_id, grade_level, unit_name, difficulty, content, choices, answer, explanation, status, source, updated_at")
    .order("updated_at", { ascending: false }).limit(100);
  if (queryText) query = query.ilike("content", `%${queryText}%`);
  if (status) query = query.eq("status", status);
  const modern = await query;
  let schemaReady = true;
  let questions: QuestionRow[];
  if (!modern.error) {
    questions = (modern.data ?? []) as QuestionRow[];
  } else if (isMissingSchemaError(modern.error)) {
    schemaReady = false;
    let legacyQuery = admin.from("questions")
      .select("id, subject_id, difficulty, content, choices, answer, explanation, source, created_at, units(name, grade_level)")
      .like("source", "developer%").order("created_at", { ascending: false }).limit(100);
    if (queryText) legacyQuery = legacyQuery.ilike("content", `%${queryText}%`);
    if (status) legacyQuery = legacyQuery.eq("source", `developer:${status}`);
    const { data: legacyRows } = await legacyQuery;
    questions = ((legacyRows ?? []) as unknown as LegacyQuestionRow[]).map(fromLegacyQuestion);
  } else {
    console.error("[developer-questions] list failed:", modern.error.message);
    questions = [];
  }
  let editing = params.edit ? questions.find((question) => question.id === params.edit) ?? null : null;
  if (params.edit && !editing) {
    if (schemaReady) {
      editing = (await admin.from("questions").select("id, subject_id, grade_level, unit_name, difficulty, content, choices, answer, explanation, status, source, updated_at").eq("id", params.edit).maybeSingle()).data as QuestionRow | null;
    } else {
      const { data: legacy } = await admin.from("questions")
        .select("id, subject_id, difficulty, content, choices, answer, explanation, source, created_at, units(name, grade_level)")
        .eq("id", params.edit).maybeSingle();
      editing = legacy ? fromLegacyQuestion(legacy as unknown as LegacyQuestionRow) : null;
    }
  }
  const choices = editing?.choices?.length ? editing.choices : ["", "", "", ""];

  return <div className="flex flex-col gap-6">
    <div className="flex items-end justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><FileQuestion className="h-6 w-6 text-emerald-400" />Question Studio</h1><p className="mt-1 text-sm text-zinc-400">객관식 문제를 작성하고 공개 상태를 관리합니다.</p></div>{editing && <Button asChild variant="outline"><Link href="/developer/questions"><Plus className="h-4 w-4" />새 문제</Link></Button>}</div>
    {params.error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{ERRORS[params.error] ?? "관리 작업을 완료하지 못했습니다."}</p>}
    {(params.saved || params.updated) && <p className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">{params.saved ? "문제가 저장되었습니다." : "문제 상태가 변경되었습니다."}{params.compat && " 현재 DB가 이전 버전이어서 호환 모드로 처리했습니다."}</p>}
    {!schemaReady && <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><strong>Legacy Question Mode</strong><p className="mt-1 text-xs text-amber-200/70">`0021_developer_console.sql`이 적용되지 않아 단원과 source 필드로 문제 메타데이터를 안전하게 호환 저장합니다.</p></div>}
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">{editing ? "문제 수정" : "새 문제 출제"}</CardTitle></CardHeader><CardContent>
      <form action={saveDeveloperQuestion} className="grid gap-4 sm:grid-cols-2">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <Field label="학년"><select name="grade_level" defaultValue={editing?.grade_level ?? "중1"} className={selectClass}>{GRADE_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}</select></Field>
        <Field label="과목"><select name="subject_id" defaultValue={editing?.subject_id ?? "math"} className={selectClass}><option value="math">수학</option><option value="english">영어</option><option value="social">사회</option><option value="science">과학</option></select></Field>
        <Field label="단원"><Input name="unit_name" maxLength={100} defaultValue={editing?.unit_name ?? ""} className={inputClass} placeholder="예: 일차방정식" /></Field>
        <Field label="난이도"><select name="difficulty" defaultValue={editing?.difficulty ?? 2} className={selectClass}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Level {level}</option>)}</select></Field>
        <div className="flex flex-col gap-2 sm:col-span-2"><Label>문제 내용</Label><textarea name="content" required minLength={2} maxLength={5000} rows={4} defaultValue={editing?.content ?? ""} className={textareaClass} /></div>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <Field key={index} label={`보기 ${index + 1}${index >= 2 ? " (선택)" : ""}`}><Input name="choice" defaultValue={choices[index] ?? ""} required={index < 2} maxLength={500} className={inputClass} /></Field>)}</div>
        <Field label="정답"><Input name="answer" required maxLength={500} defaultValue={editing?.answer ?? ""} className={inputClass} placeholder="보기 중 하나와 정확히 일치" /></Field>
        <Field label="상태"><select name="status" defaultValue={editing?.status === "archived" ? "draft" : editing?.status ?? "draft"} className={selectClass}><option value="draft">Draft</option><option value="published">Published</option></select></Field>
        <div className="flex flex-col gap-2 sm:col-span-2"><Label>해설</Label><textarea name="explanation" maxLength={5000} rows={3} defaultValue={editing?.explanation ?? ""} className={textareaClass} /></div>
        <Button type="submit" className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400 sm:col-span-2">{editing ? "수정 저장" : "문제 저장"}</Button>
      </form>
    </CardContent></Card>

    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">Question Bank</CardTitle><form className="grid gap-2 pt-2 sm:grid-cols-[1fr_150px_auto]"><Input name="q" defaultValue={queryText} className={inputClass} placeholder="문제 내용 검색" /><select name="status" defaultValue={status} className={selectClass}><option value="">모든 상태</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><Button type="submit" variant="outline">검색</Button></form></CardHeader><CardContent className="flex flex-col gap-2">
      {questions.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">문제가 없습니다.</p>}
      {questions.map((question) => <div key={question.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2"><Badge variant={question.status === "published" ? "success" : "secondary"}>{question.status}</Badge><Badge variant="outline">{question.grade_level ?? "공통"} · {question.subject_id}</Badge><Badge variant="outline">Lv.{question.difficulty}</Badge><span className="text-[10px] text-zinc-600">{question.source}</span></div><p className="line-clamp-2 whitespace-pre-wrap text-sm font-medium">{question.content}</p><p className="mt-2 text-xs text-zinc-500">정답: {question.answer} · {question.unit_name || "단원 없음"}</p></div><div className="flex gap-1"><Button asChild size="sm" variant="outline"><Link href={`/developer/questions?edit=${question.id}`}><Pencil className="h-3.5 w-3.5" /></Link></Button>{question.status !== "published" && <form action={setDeveloperQuestionStatus.bind(null, question.id, "published")}><Button size="sm" variant="outline" title="공개"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /></Button></form>}{question.status !== "archived" ? <form action={setDeveloperQuestionStatus.bind(null, question.id, "archived")}><Button size="sm" variant="outline" title="보관"><Archive className="h-3.5 w-3.5" /></Button></form> : <form action={setDeveloperQuestionStatus.bind(null, question.id, "draft")}><Button size="sm" variant="outline" title="초안 복원"><RotateCcw className="h-3.5 w-3.5" /></Button></form>}</div></div></div>)}
    </CardContent></Card>
  </div>;
}

const inputClass = "border-zinc-700 bg-zinc-950";
const selectClass = "h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm";
const textareaClass = "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div>;
}

function fromLegacyQuestion(row: LegacyQuestionRow): QuestionRow {
  const unit = Array.isArray(row.units) ? row.units[0] : row.units;
  const suffix = row.source.split(":")[1];
  return {
    id: row.id,
    subject_id: row.subject_id,
    grade_level: unit?.grade_level ?? null,
    unit_name: unit?.name ?? "직접 출제",
    difficulty: row.difficulty,
    content: row.content,
    choices: row.choices,
    answer: row.answer,
    explanation: row.explanation,
    status: suffix === "draft" || suffix === "archived" ? suffix : "published",
    source: row.source,
    updated_at: row.created_at,
  };
}
