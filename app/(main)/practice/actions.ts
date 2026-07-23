"use server";

import { createClient } from "@/lib/supabase/server";
import { getPracticeQuestion } from "@/lib/practice/question-bank";

export interface PracticeAnswerResult {
  ok: boolean;
  correct: boolean;
  answer?: string;
  explanation?: string;
  rewardGranted?: boolean;
  error?: string;
}

export async function submitPracticeAnswer(questionKey: string, userAnswer: string): Promise<PracticeAnswerResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, correct: false, error: "로그인이 필요합니다." };

  const question = getPracticeQuestion(questionKey);
  const answer = userAnswer.trim();
  if (!question || !answer || answer.length > 500) {
    return { ok: false, correct: false, error: "올바르지 않은 답안입니다." };
  }

  const correct = answer === question.answer;
  const { data, error } = await supabase.rpc("record_practice_attempt", {
    p_question_key: question.key,
    p_grade_level: question.gradeLevel,
    p_subject_id: question.subjectId,
    p_unit_name: question.unitName,
    p_user_answer: answer,
    p_is_correct: correct,
  });

  // 새 마이그레이션을 아직 적용하지 않은 개발 DB에서도 채점 자체는 이용할 수 있다.
  if (error) {
    console.error("[practice] attempt persistence failed:", error.message);
  }

  return {
    ok: true,
    correct,
    answer: question.answer,
    explanation: question.explanation,
    rewardGranted: Boolean(data?.[0]?.reward_granted),
  };
}
