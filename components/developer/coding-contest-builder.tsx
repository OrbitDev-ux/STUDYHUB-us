"use client";

import { useMemo, useState } from "react";
import { createDeveloperCodingContest } from "@/app/developer/actions";
import { GRADE_LEVELS } from "@/lib/practice/question-bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type JudgeProblem = {
  id: string;
  title: string;
  difficulty: number;
  grade_level: string | null;
};

export function CodingContestBuilder({ problems }: { problems: JudgeProblem[] }) {
  const [grade, setGrade] = useState("중1");
  const available = useMemo(() => problems.filter((problem) => !problem.grade_level || problem.grade_level === grade), [grade, problems]);
  const defaultStart = new Date(Date.now() + 10 * 60_000);
  const localStart = new Date(defaultStart.getTime() - defaultStart.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return <form action={createDeveloperCodingContest} className="grid gap-4 sm:grid-cols-2">
    <Field label="대회명"><Input name="title" required minLength={2} maxLength={100} className={inputClass} placeholder="예: Output Judge Round #1" /></Field>
    <Field label="진행 시간"><Input name="duration_minutes" type="number" min={5} max={360} defaultValue={90} required className={inputClass} /></Field>
    <Field label="학년"><select name="grade_level" value={grade} onChange={(event) => setGrade(event.target.value)} className={selectClass}>{GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></Field>
    <Field label="시작 시각"><Input name="starts_at" type="datetime-local" defaultValue={localStart} required className={inputClass} /></Field>
    <div className="flex gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="is_rated" defaultChecked />Rated 등록 허용</label><label className="flex items-center gap-2"><input type="checkbox" name="publish_now" defaultChecked />즉시 공개</label></div>
    <div />
    <div className="flex flex-col gap-2 sm:col-span-2"><Label>대회 안내</Label><textarea name="description" rows={3} maxLength={2000} className={textareaClass} /></div>
    <div className="sm:col-span-2"><Label>고정 Input 코딩 문제 선택</Label><div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3">{available.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">이 학년에서 공개된 Output Judge 문제가 없습니다.</p>}{available.map((problem) => <label key={problem.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 p-3 hover:border-emerald-700"><input type="checkbox" name="judge_problem_id" value={problem.id} /><span className="font-semibold">{problem.title}</span><span className="ml-auto text-xs text-emerald-300">Level {problem.difficulty} · {problem.grade_level || "전체"}</span></label>)}</div></div>
    <Button type="submit" className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400 sm:col-span-2">Output Judge 대회 생성</Button>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><Label>{label}</Label>{children}</div>;
}
const inputClass = "border-zinc-700 bg-zinc-950";
const selectClass = "h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm";
const textareaClass = "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm";
