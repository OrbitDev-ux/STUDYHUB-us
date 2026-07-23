"use client";

import { useMemo, useState } from "react";
import { createDeveloperContest } from "@/app/developer/actions";
import { GRADE_LEVELS } from "@/lib/practice/question-bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QuestionOption = {
  id: string; grade_level: string | null; subject_id: string; unit_name: string | null;
  difficulty: number; content: string;
};

export function ContestBuilder({ questions, publishingSupported = true }: { questions: QuestionOption[]; publishingSupported?: boolean }) {
  const [grade, setGrade] = useState("중1");
  const [subject, setSubject] = useState("math");
  const available = useMemo(() => questions.filter((question) => question.grade_level === grade && question.subject_id === subject), [questions, grade, subject]);
  const defaultStart = new Date(Date.now() + 10 * 60_000);
  const localStart = new Date(defaultStart.getTime() - defaultStart.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return <form action={createDeveloperContest} className="grid gap-4 sm:grid-cols-2">
    <Field label="대회명"><Input name="title" minLength={2} maxLength={100} required className={inputClass} placeholder="예: 중1 수학 Rated Round #1" /></Field>
    <Field label="진행 시간"><Input name="duration_minutes" type="number" min={5} max={360} defaultValue={60} required className={inputClass} /></Field>
    <Field label="학년"><select name="grade_level" value={grade} onChange={(event) => setGrade(event.target.value)} className={selectClass}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></Field>
    <Field label="과목"><select name="subject_id" value={subject} onChange={(event) => setSubject(event.target.value)} className={selectClass}><option value="math">수학</option><option value="english">영어</option><option value="social">사회</option><option value="science">과학</option></select></Field>
    <Field label="시작 시각"><Input name="starts_at" type="datetime-local" defaultValue={localStart} required className={inputClass} /></Field>
    <div className="flex flex-col justify-end gap-2 pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_rated" defaultChecked />Rated Contest</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish_now" defaultChecked disabled={!publishingSupported} />즉시 공개</label>{!publishingSupported && <><input type="hidden" name="publish_now" value="on" /><span className="text-[10px] text-amber-400">호환 모드에서는 공개 대회로만 생성됩니다.</span></>}</div>
    <div className="flex flex-col gap-2 sm:col-span-2"><Label>대회 안내</Label><textarea name="description" maxLength={2000} rows={3} className={textareaClass} /></div>
    <div className="sm:col-span-2"><div className="mb-2 flex items-center justify-between"><Label>출제 문제 선택</Label><span className="text-xs text-zinc-500">선택하지 않으면 공개 문제와 자동 생성 문제로 10개 구성</span></div><div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3">{available.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">이 학년·과목에 공개된 직접 출제 문제가 없습니다.</p>}{available.map((question) => <label key={question.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 p-3 hover:border-emerald-700"><input type="checkbox" name="question_id" value={question.id} className="mt-1" /><span className="min-w-0"><span className="text-xs text-emerald-300">{question.unit_name || "직접 출제"} · Lv.{question.difficulty}</span><span className="mt-1 block line-clamp-2 text-sm">{question.content}</span></span></label>)}</div></div>
    <Button type="submit" className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400 sm:col-span-2">대회 생성</Button>
  </form>;
}

const inputClass = "border-zinc-700 bg-zinc-950";
const selectClass = "h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm";
const textareaClass = "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div>;
}
