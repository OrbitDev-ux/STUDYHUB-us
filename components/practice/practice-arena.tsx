"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  GRADE_LEVELS,
  generatePracticeSet,
  type GradeLevel,
} from "@/lib/practice/question-bank";
import type { SubjectId } from "@/types";
import { submitPracticeAnswer, type PracticeAnswerResult } from "@/app/(main)/practice/actions";

const SUBJECTS: { id: SubjectId; label: string }[] = [
  { id: "math", label: "수학" }, { id: "english", label: "영어" },
  { id: "social", label: "사회" }, { id: "science", label: "과학" },
];

export function PracticeArena({ initialGrade }: { initialGrade: GradeLevel }) {
  const [grade, setGrade] = useState<GradeLevel>(initialGrade);
  const [subject, setSubject] = useState<SubjectId>("math");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<PracticeAnswerResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const questions = useMemo(() => generatePracticeSet(grade, subject), [grade, subject]);
  const question = questions[index]!;

  function reset(nextGrade = grade, nextSubject = subject) {
    setGrade(nextGrade); setSubject(nextSubject); setIndex(0); setSelected(null);
    setResult(null); setCorrectCount(0); setAnsweredCount(0);
  }

  function submit(choice: string) {
    if (result || isPending) return;
    setSelected(choice);
    startTransition(async () => {
      const nextResult = await submitPracticeAnswer(question.key, choice);
      setResult(nextResult);
      if (nextResult.ok) {
        setAnsweredCount((value) => value + 1);
        if (nextResult.correct) setCorrectCount((value) => value + 1);
      }
    });
  }

  function next() {
    setSelected(null); setResult(null);
    setIndex((value) => (value + 1) % questions.length);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            학년
            <select
              value={grade}
              onChange={(event) => reset(event.target.value as GradeLevel, subject)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {GRADE_LEVELS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            과목
            <select
              value={subject}
              onChange={(event) => reset(grade, event.target.value as SubjectId)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {SUBJECTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="푼 문제" value={`${answeredCount}문제`} />
        <MiniStat label="맞힌 문제" value={`${correctCount}문제`} />
        <MiniStat label="현재 정답률" value={answeredCount ? `${Math.round(correctCount / answeredCount * 100)}%` : "—"} />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{grade}</Badge>
              <Badge variant="outline">{SUBJECTS.find((item) => item.id === subject)?.label}</Badge>
              <Badge variant="outline">{question.unitName}</Badge>
              <Badge variant="warning">난이도 {question.difficulty}</Badge>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{index + 1} / {questions.length}</span>
          </div>
          <Progress value={((index + 1) / questions.length) * 100} />
          <CardTitle className="whitespace-pre-line pt-2 text-lg leading-relaxed">{question.content}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {question.choices.map((choice, choiceIndex) => {
            const showCorrect = result?.ok && choice === result.answer;
            const showWrong = result?.ok && choice === selected && !result.correct;
            return (
              <Button
                key={`${choice}-${choiceIndex}`}
                type="button"
                variant="outline"
                disabled={Boolean(result) || isPending}
                onClick={() => submit(choice)}
                className={`h-auto min-h-12 justify-start whitespace-normal py-3 text-left ${showCorrect ? "border-success bg-success/10 text-success" : ""} ${showWrong ? "border-destructive bg-destructive/10 text-destructive" : ""}`}
              >
                <span className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs">{choiceIndex + 1}</span>
                {choice}
              </Button>
            );
          })}

          {isPending && <p className="text-sm text-muted-foreground">답안을 확인하고 있어요...</p>}
          {result && !result.ok && <p className="text-sm text-destructive">{result.error}</p>}
          {result?.ok && (
            <div className={`mt-2 rounded-xl border p-4 ${result.correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {result.correct ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
                {result.correct ? "정답이에요!" : `정답은 ${result.answer}입니다.`}
                {result.rewardGranted && <Badge variant="success" className="ml-auto"><Sparkles className="mr-1 h-3 w-3" />+2 XP</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{result.explanation}</p>
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <Button type="button" variant="outline" onClick={() => reset()} className="gap-2">
              <RotateCcw className="h-4 w-4" /> 처음부터
            </Button>
            {result?.ok && <Button type="button" onClick={next} className="ml-auto gap-2">다음 문제 <ChevronRight className="h-4 w-4" /></Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></CardContent></Card>;
}
