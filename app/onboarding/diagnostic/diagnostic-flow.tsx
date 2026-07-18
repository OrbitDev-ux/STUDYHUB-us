"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { fetchDiagnosticQuestions, submitDiagnosticResult } from "../actions";
import type { GeneratedQuestion } from "@/lib/ai/diagnostic";
import type { SubjectId } from "@/types";
import { Loader2, CheckCircle2 } from "lucide-react";

const SUBJECT_IDS: SubjectId[] = ["math", "english", "social", "science"];

type Phase = "loading" | "answering" | "grading" | "result";

export function DiagnosticFlow() {
  const router = useRouter();
  const t = useTranslations("diagnostic");
  const tc = useTranslations("common");
  const ts = useTranslations("subjects");
  const [subjectIndex, setSubjectIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ grade: string; band: string; message: string } | null>(
    null
  );
  const [started, setStarted] = useState(false);

  const subjectId = SUBJECT_IDS[subjectIndex]!;
  const subjectLabel = ts(subjectId);

  async function loadSubject() {
    setPhase("loading");
    setQIndex(0);
    setAnswers([]);
    const qs = await fetchDiagnosticQuestions(subjectId);
    setQuestions(qs);
    setPhase("answering");
  }

  async function handleAnswer(choice: string) {
    const next = [...answers, choice];
    setAnswers(next);
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
    } else {
      setPhase("grading");
      const answered = questions.map((q, i) => ({
        content: q.content,
        unit_name: q.unit_name,
        correct: next[i] === q.answer,
        difficulty: q.difficulty,
      }));
      const result = await submitDiagnosticResult({ subject: subjectId, answered });
      setSummary({
        grade: result.analysis.predicted_grade,
        band: result.analysis.percentile_band,
        message: result.analysis.ai_summary,
      });
      setPhase("result");
    }
  }

  function handleNextSubject() {
    if (subjectIndex + 1 < SUBJECT_IDS.length) {
      setSubjectIndex(subjectIndex + 1);
      loadSubject();
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  if (!started) {
    return (
      <Card className="w-full max-w-lg animate-slide-up">
        <CardHeader>
          <CardTitle>{t("introTitle")}</CardTitle>
          <CardDescription>{t("introDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => {
              setStarted(true);
              loadSubject();
            }}
          >
            {t("start")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg animate-slide-up">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <Badge variant="secondary">
            {t("progressBadge", { current: subjectIndex + 1, total: SUBJECT_IDS.length, subject: subjectLabel })}
          </Badge>
          {phase === "answering" && (
            <span className="text-xs text-muted-foreground">
              {t("questionProgress", { current: qIndex + 1, total: questions.length })}
            </span>
          )}
        </div>
        {phase === "answering" && (
          <Progress value={((qIndex + 1) / Math.max(questions.length, 1)) * 100} />
        )}
        <CardTitle className="pt-2">
          {phase === "loading" && t("preparing")}
          {phase === "answering" && t("subjectQuiz", { subject: subjectLabel })}
          {phase === "grading" && t("analyzing")}
          {phase === "result" && t("subjectResult", { subject: subjectLabel })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          {(phase === "loading" || phase === "grading") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-12 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {phase === "loading" ? t("loadingQuestions") : t("loadingAnalysis")}
              </p>
            </motion.div>
          )}

          {phase === "answering" && questions[qIndex] && (
            <motion.div
              key={qIndex}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex flex-col gap-4"
            >
              <p className="font-medium leading-relaxed">{questions[qIndex].content}</p>
              <div className="flex flex-col gap-2">
                {(questions[qIndex].choices ?? ["O", "X"]).map((choice) => (
                  <Button
                    key={choice}
                    variant="outline"
                    className="justify-start whitespace-normal text-left h-auto py-3"
                    onClick={() => handleAnswer(choice)}
                  >
                    {choice}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "result" && summary && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-3 rounded-xl bg-accent p-4">
                <CheckCircle2 className="h-6 w-6 text-accent-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{tc("predictedGrade")}</p>
                  <p className="text-xl font-bold">
                    {summary.grade} <span className="text-sm font-normal text-muted-foreground">({summary.band})</span>
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{summary.message}</p>
              <Button onClick={handleNextSubject}>
                {subjectIndex + 1 < SUBJECT_IDS.length ? t("nextSubject") : t("goDashboard")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
