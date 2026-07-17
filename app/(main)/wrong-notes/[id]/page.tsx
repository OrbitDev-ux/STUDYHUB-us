import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WrongNoteDetail } from "@/components/homework/wrong-note-detail";

export const metadata = { title: "오답 상세" };

export default async function WrongNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wrong } = await supabase
    .from("wrong_answers")
    .select("*, questions(*, units(name))")
    .eq("id", id)
    .single();

  if (!wrong) redirect("/wrong-notes");

  let similarQuestions: { id: string; content: string; choices: string[] | null; explanation: string | null }[] = [];
  if (wrong.similar_question_ids?.length) {
    const { data } = await supabase
      .from("questions")
      .select("id, content, choices, explanation")
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
            <Badge variant="warning">{wrong.wrong_count}회 오답</Badge>
            {question.units?.name && <Badge variant="outline">{question.units.name}</Badge>}
          </div>
          <CardTitle className="text-base leading-relaxed">{question.content}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm">
            내가 쓴 답: <span className="font-medium text-destructive">{wrong.user_answer}</span>
          </p>
          <p className="text-sm">
            정답: <span className="font-medium text-success">{question.answer}</span>
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
