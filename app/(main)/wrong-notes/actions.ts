"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateSimilarQuestion } from "@/lib/ai/homework";
import type { SubjectId } from "@/types";

export async function generateSimilarQuestionForWrongAnswer(wrongAnswerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wrong } = await supabase
    .from("wrong_answers")
    .select("*, questions(*, units(name))")
    .eq("id", wrongAnswerId)
    .single();

  if (!wrong) throw new Error("오답 정보를 찾을 수 없습니다.");

  const original = wrong.questions as unknown as {
    content: string;
    subject_id: SubjectId;
    difficulty: number;
    units: { name: string } | null;
  };

  const generated = await generateSimilarQuestion({
    content: original.content,
    subject_id: original.subject_id,
    unit_name: original.units?.name ?? "기타",
    difficulty: original.difficulty,
  });

  const admin = createAdminClient();
  const { data: newQuestion } = await admin
    .from("questions")
    .insert({
      subject_id: generated.subject_id,
      unit_id: wrong.unit_id,
      type: generated.type,
      difficulty: generated.difficulty,
      content: generated.content,
      choices: generated.choices,
      answer: generated.answer,
      explanation: generated.explanation,
      source: "ai_generated",
      generated_from_question_id: wrong.question_id,
    })
    .select("id")
    .single();

  const updatedIds = [...(wrong.similar_question_ids ?? []), newQuestion!.id];
  await supabase.from("wrong_answers").update({ similar_question_ids: updatedIds }).eq("id", wrongAnswerId);

  revalidatePath(`/wrong-notes/${wrongAnswerId}`);
  return newQuestion!.id as string;
}

export async function retrySimilarQuestion(wrongAnswerId: string, questionId: string, userAnswer: string) {
  const supabase = await createClient();
  const { data: question } = await supabase.from("questions").select("answer, explanation").eq("id", questionId).single();
  if (!question) throw new Error("문제를 찾을 수 없습니다.");

  const isCorrect = question.answer.trim() === userAnswer.trim();

  if (isCorrect) {
    await supabase.from("wrong_answers").update({ mastered: true }).eq("id", wrongAnswerId);
  }

  revalidatePath(`/wrong-notes/${wrongAnswerId}`);
  return { isCorrect, explanation: question.explanation as string };
}
