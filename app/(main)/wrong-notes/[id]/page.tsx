import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WrongNoteDetail } from "@/components/homework/wrong-note-detail";

export async function generateMetadata() {
  const t = await getTranslations("wrongNotes");
  return { title: t("title") };
}

export default async function WrongNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("wrongNotes");

  const { data: wrong } = await supabase
    .from("wrong_answers")
    .select("*, questions(*, units(name))")
    .eq("id", id)
    .single();

  if (!wrong) redirect("/wrong-notes");

  let similarQuestions: { id: string; content: string; type: string; choices: string[] | null; explanation: string | null }[] = [];
  if (wrong.similar_question_ids?.length) {
    const { data } = await supabase
      .from("questions")
      .select("id, content, type, choices, explanation")
      .in("id", wrong.similar_question_ids);
    similarQuestions = data ?? [];
  }

  const question = wrong.questions as unknown as {
    content: string;
    choices: string[] | null;
    answer: string;
    explanation: string | null;
    units: { name: string } | null;
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="mb-1 flex gap-2">
            <Badge variant="warning">{t("wrongCount", { count: wrong.wrong_count })}</Badge>
            {question.units?.name && <Badge variant="outline">{question.units.name}</Badge>}
          </div>
          <CardTitle className="text-base leading-relaxed">{question.content}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm">
            {t("myAnswer")} <span className="font-medium text-destructive">{wrong.user_answer}</span>
          </p>
          <p className="text-sm">
            {t("correctAnswer")} <span className="font-medium text-success">{question.answer}</span>
          </p>
          {question.explanation && (
            <div className="mt-2 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
              {question.explanation}
            </div>
          )}
        </CardContent>
      </Card>

      <WrongNoteDetail wrongAnswerId={wrong.id} mastered={wrong.mastered} similarQuestions={similarQuestions} />
    </div>
  );
}
