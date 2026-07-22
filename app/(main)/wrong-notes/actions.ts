"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateSimilarQuestion } from "@/lib/ai/homework";
import type { SubjectId } from "@/types";
import { answersMatch } from "@/lib/homework/answer";
import { awardXP } from "@/lib/gamification/xp";

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
    .eq("user_id", user.id)
    .single();

  if (!wrong) throw new Error("오답 정보를 찾을 수 없습니다.");
  if ((wrong.similar_question_ids ?? []).length >= 5) {
    throw new Error("한 오답당 유사 문제는 최대 5개까지 생성할 수 있습니다.");
  }

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
  const { data: newQuestion, error: questionError } = await admin
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

  if (questionError || !newQuestion) {
    throw new Error(`유사 문제 저장 실패: ${questionError?.message ?? "unknown error"}`);
  }

  const updatedIds = [...new Set([...(wrong.similar_question_ids ?? []), newQuestion.id])];
  const { error: updateError } = await supabase
    .from("wrong_answers")
    .update({ similar_question_ids: updatedIds })
    .eq("id", wrongAnswerId)
    .eq("user_id", user.id);
  if (updateError) {
    await admin.from("questions").delete().eq("id", newQuestion.id);
    throw new Error(`오답노트 갱신 실패: ${updateError.message}`);
  }

  revalidatePath(`/wrong-notes/${wrongAnswerId}`);
  return newQuestion.id as string;
}

export async function retrySimilarQuestion(wrongAnswerId: string, questionId: string, userAnswer: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wrong } = await supabase
    .from("wrong_answers")
    .select("id, mastered, similar_question_ids, wrong_count")
    .eq("id", wrongAnswerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!wrong || !(wrong.similar_question_ids ?? []).includes(questionId)) {
    throw new Error("이 오답노트에 속한 유사 문제가 아닙니다.");
  }

  const { data: question } = await supabase.from("questions").select("answer, explanation").eq("id", questionId).single();
  if (!question) throw new Error("문제를 찾을 수 없습니다.");

  const answer = userAnswer.trim().slice(0, 500);
  if (!answer) throw new Error("답을 입력해주세요.");
  const isCorrect = answersMatch(question.answer, answer);

  if (isCorrect) {
    const { error } = await supabase
      .from("wrong_answers")
      .update({ mastered: true })
      .eq("id", wrongAnswerId)
      .eq("user_id", user.id);
    if (error) throw new Error(`오답 상태 갱신 실패: ${error.message}`);
    if (!wrong.mastered) {
      await awardXP(supabase, 10, "오답 유사 문제 극복");
      revalidatePath("/", "layout");
    }
  } else {
    const { error } = await supabase
      .from("wrong_answers")
      .update({
        wrong_count: (wrong.wrong_count ?? 0) + 1,
        user_answer: answer,
        last_wrong_at: new Date().toISOString(),
      })
      .eq("id", wrongAnswerId)
      .eq("user_id", user.id);
    if (error) throw new Error(`오답 기록 갱신 실패: ${error.message}`);
  }

  revalidatePath(`/wrong-notes/${wrongAnswerId}`);
  revalidatePath("/wrong-notes");
  return {
    isCorrect,
    explanation: (question.explanation as string | null) ?? "",
    correctAnswer: question.answer as string,
  };
}
