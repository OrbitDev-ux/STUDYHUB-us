"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  generateSimilarQuestionForWrongAnswer,
  retrySimilarQuestion,
} from "@/app/(main)/wrong-notes/actions";
import { QuestionAnswerControls } from "./question-answer-controls";

interface SimilarQuestion {
  id: string;
  content: string;
  type: string;
  choices: string[] | null;
  explanation: string | null;
}

export function WrongNoteDetail({
  wrongAnswerId,
  mastered,
  similarQuestions,
}: {
  wrongAnswerId: string;
  mastered: boolean;
  similarQuestions: SimilarQuestion[];
}) {
  const t = useTranslations("wrongNotes");
  const tc = useTranslations("common");
  const [questions] = useState(similarQuestions);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { correct: boolean; explanation: string; answer: string; correctAnswer: string }>>({});
  const [isMastered, setIsMastered] = useState(mastered);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      await generateSimilarQuestionForWrongAnswer(wrongAnswerId);
      window.location.reload();
    } catch {
      setError(t("actionError"));
      setLoading(false);
    }
  }

  async function handleAnswer(q: SimilarQuestion, answer: string) {
    setPendingId(q.id);
    setError(null);
    try {
      const result = await retrySimilarQuestion(wrongAnswerId, q.id, answer);
      setResults((prev) => ({
        ...prev,
        [q.id]: { correct: result.isCorrect, explanation: result.explanation, correctAnswer: result.correctAnswer, answer },
      }));
      if (result.isCorrect) setIsMastered(true);
    } catch {
      setError(t("actionError"));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!isMastered && (
        <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {t("generateSimilar")}
        </Button>
      )}
      {isMastered && (
        <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> {t("masteredMessage")}
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {questions
        .filter((q) => q.content)
        .map((q) => {
          const result = results[q.id];
          return (
            <Card key={q.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <p className="font-medium leading-relaxed">{q.content}</p>
                {!result ? (
                  <QuestionAnswerControls
                    type={q.type}
                    choices={q.choices}
                    disabled={pendingId === q.id}
                    onAnswer={(answer) => handleAnswer(q, answer)}
                    submitLabel={t("submitAnswer")}
                    placeholder={t("answerPlaceholder")}
                  />
                ) : (
                  <div
                    className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                      result.correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {result.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div>
                      <p className="font-medium">{result.correct ? tc("correct") : t("wrongAgain")}</p>
                      {!result.correct && <p className="mt-1 text-foreground/90">{t("correctAnswer")} {result.correctAnswer}</p>}
                      <p className="mt-1 text-foreground/80">{result.explanation}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
