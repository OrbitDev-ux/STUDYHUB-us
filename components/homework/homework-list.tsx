"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { submitHomeworkAnswer, completeHomeworkIfDone } from "@/app/(main)/homework/actions";
import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { QuestionAnswerControls } from "./question-answer-controls";

interface Item {
  id: string;
  category: string;
  order_index: number;
  user_answer: string | null;
  is_correct: boolean | null;
  questions: {
    id: string;
    content: string;
    type: string;
    choices: string[] | null;
    explanation: string | null;
  };
}

export function HomeworkList({ homeworkId, items }: { homeworkId: string; items: Item[] }) {
  const router = useRouter();
  const t = useTranslations("homework");
  const tc = useTranslations("common");
  const [localItems, setLocalItems] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleAnswer(item: Item, answer: string) {
    setPendingId(item.id);
    setError(null);
    try {
      const result = await submitHomeworkAnswer(item.id, item.questions.id, answer);
      setLocalItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, user_answer: answer, is_correct: result.isCorrect } : i))
      );
      setCorrectAnswers((prev) => ({ ...prev, [item.id]: result.correctAnswer }));

      const allDone = localItems.every((i) => i.id === item.id || i.is_correct !== null);
      if (allDone) {
        await completeHomeworkIfDone(homeworkId);
        router.refresh();
      }
    } catch {
      setError(t("actionError"));
    } finally {
      setPendingId(null);
    }
  }

  const completedCount = localItems.filter((i) => i.is_correct !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("completedProgress", { completed: completedCount, total: localItems.length })}
      </p>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {localItems.map((item, idx) => (
        <Card key={item.id}>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                {idx + 1}. {t.has(`categories.${item.category}`) ? t(`categories.${item.category}`) : item.category}
              </Badge>
              {item.is_correct !== null &&
                (item.is_correct ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                ))}
            </div>
            <p className="font-medium leading-relaxed">{item.questions.content}</p>

            {item.is_correct === null ? (
              <QuestionAnswerControls
                type={item.questions.type}
                choices={item.questions.choices}
                disabled={pendingId === item.id}
                onAnswer={(answer) => handleAnswer(item, answer)}
                submitLabel={t("submitAnswer")}
                placeholder={t("answerPlaceholder")}
              />
            ) : (
              <div
                className={`rounded-xl p-3 text-sm ${
                  item.is_correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                <p className="font-medium">
                  {item.is_correct ? tc("correct") : t("wrongAnswer", { answer: item.user_answer ?? "" })}
                </p>
                {!item.is_correct && correctAnswers[item.id] && (
                  <p className="mt-1 text-foreground/90">{t("correctAnswer", { answer: correctAnswers[item.id] ?? "" })}</p>
                )}
                {item.questions.explanation && (
                  <p className="mt-1 text-foreground/80">{item.questions.explanation}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
