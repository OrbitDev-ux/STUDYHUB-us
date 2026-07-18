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

interface SimilarQuestion {
  id: string;
  content: string;
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
  const [questions, setQuestions] = useState(similarQuestions);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, { correct: boolean; explanation: string; answer: string }>>({});
  const [isMastered, setIsMastered] = useState(mastered);

  async function handleGenerate() {
    setLoading(true);
    const newId = await generateSimilarQuestionForWrongAnswer(wrongAnswerId);
    // fetch로 새 문제 상세를 다시 불러오기 위해 간단히 페이지 새로고침 대신 낙관적 갱신
    setQuestions((prev) => [...prev, { id: newId, content: "", choices: null, explanation: null }]);
    setLoading(false);
    window.location.reload();
  }

  async function handleAnswer(q: SimilarQuestion, answer: string) {
    const result = await retrySimilarQuestion(wrongAnswerId, q.id, answer);
    setResults((prev) => ({ ...prev, [q.id]: { correct: result.isCorrect, explanation: result.explanation, answer } }));
    if (result.isCorrect) setIsMastered(true);
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

      {questions
        .filter((q) => q.content)
        .map((q) => {
          const result = results[q.id];
          return (
            <Card key={q.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <p className="font-medium leading-relaxed">{q.content}</p>
                {!result ? (
                  <div className="flex flex-col gap-2">
                    {(q.choices ?? ["O", "X"]).map((choice) => (
                      <Button
                        key={choice}
                        variant="outline"
                        className="h-auto justify-start whitespace-normal py-3 text-left"
                        onClick={() => handleAnswer(q, choice)}
                      >
                        {choice}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                      result.correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {result.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div>
                      <p className="font-medium">{result.correct ? tc("correct") : t("wrongAgain")}</p>
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
