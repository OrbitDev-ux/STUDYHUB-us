"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateDailyHomework } from "@/lib/ai/homework";
import { insertHomeworkItems } from "@/lib/homework/persist";
import { getWeakUnitsBySubject } from "@/lib/homework/weak-units";
import { awardXP, checkAndAwardBadges } from "@/lib/gamification/xp";
import { todayKST } from "@/lib/utils/date";
import type { SubjectId } from "@/types";
import { getHomeworkQuestionCount, getUserPlan } from "@/lib/supabase/compat";

/** 오늘 숙제가 없으면 AI로 생성해서 DB에 저장 (사용자가 처음 /homework 접속 시 or 크론에서도 호출) */
export async function ensureTodayHomework() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayKST();

  const { data: existing } = await supabase
    .from("homeworks")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) return existing.id as string;

  const [{ data: profile }, plan, homeworkQuestionCount, weakUnitsBySubject, { data: wrongAnswers }] = await Promise.all([
    supabase.from("profiles").select("grade_level, target_study_minutes").eq("id", user.id).single(),
    getUserPlan(supabase, user.id),
    getHomeworkQuestionCount(supabase, user.id),
    getWeakUnitsBySubject(supabase, user.id),
    supabase
      .from("wrong_answers")
      .select("subject_id, unit_id, question_id, questions(content, unit_id, units(name))")
      .eq("user_id", user.id)
      .eq("mastered", false)
      .order("last_wrong_at", { ascending: false })
      .limit(5),
  ]);

  const wrongSummaries = (wrongAnswers ?? []).map((w) => ({
    subject: w.subject_id as SubjectId,
    unit: (w.questions as unknown as { units?: { name: string } })?.units?.name ?? "기타",
    content: (w.questions as unknown as { content: string })?.content ?? "",
  }));

  const generated = await generateDailyHomework({
    gradeLevel: profile?.grade_level ?? "중2",
    weakUnitsBySubject,
    wrongQuestionSummaries: wrongSummaries,
    targetMinutes: profile?.target_study_minutes ?? 60,
    // 설정 저장 이후 플랜이 강등됐을 수도 있으므로 상한 적용은 생성 함수 내부에서 이뤄진다.
    requestedQuestionCount: homeworkQuestionCount,
    plan,
  });

  const admin = createAdminClient();

  const { data: homework, error: hwError } = await supabase
    .from("homeworks")
    .insert({ user_id: user.id, date: today, status: "pending", ai_rationale: generated.rationale })
    .select("id")
    .single();

  if (hwError || !homework) throw new Error(hwError?.message ?? "숙제 생성 실패");

  try {
    await insertHomeworkItems(admin, homework.id, generated.items);
  } catch (error) {
    await admin.from("homeworks").delete().eq("id", homework.id).eq("user_id", user.id);
    throw error;
  }

  return homework.id as string;
}

export async function submitHomeworkAnswer(itemId: string, questionId: string, userAnswer: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 소유권 + 중복 제출 여부 확인. homework_items에는 user_id가 없으므로 homeworks를 조인해서 확인한다.
  // 이 체크가 없으면 같은 itemId로 반복 호출(devtools 재전송 등)할 때마다 XP가 무한히 지급된다.
  const { data: existingItem } = await supabase
    .from("homework_items")
    .select("id, question_id, is_correct, user_answer, homeworks!inner(user_id)")
    .eq("id", itemId)
    .eq("homeworks.user_id", user.id)
    .maybeSingle();

  if (!existingItem || existingItem.question_id !== questionId) {
    throw new Error("문제를 찾을 수 없습니다.");
  }

  const { data: question } = await supabase.from("questions").select("*").eq("id", questionId).single();
  if (!question) throw new Error("문제를 찾을 수 없습니다.");

  if (existingItem.is_correct !== null) {
    // 이미 채점된 문제 - XP를 다시 지급하지 않고 기존 결과만 반환한다.
    return { isCorrect: existingItem.is_correct, explanation: question.explanation as string };
  }

  const isCorrect = question.answer.trim() === userAnswer.trim();

  const { error: answerError } = await supabase
    .from("homework_items")
    .update({ user_answer: userAnswer, is_correct: isCorrect, answered_at: new Date().toISOString() })
    .eq("id", itemId);
  if (answerError) throw new Error(`답안 저장 실패: ${answerError.message}`);

  if (!isCorrect) {
    const { data: existingWrong } = await supabase
      .from("wrong_answers")
      .select("id, wrong_count")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingWrong) {
      const { error: wrongUpdateError } = await supabase
        .from("wrong_answers")
        .update({
          wrong_count: existingWrong.wrong_count + 1,
          user_answer: userAnswer,
          last_wrong_at: new Date().toISOString(),
          mastered: false,
        })
        .eq("id", existingWrong.id);
      if (wrongUpdateError) throw new Error(`오답 기록 갱신 실패: ${wrongUpdateError.message}`);
    } else {
      const { error: wrongInsertError } = await supabase.from("wrong_answers").insert({
        user_id: user.id,
        question_id: questionId,
        subject_id: question.subject_id,
        unit_id: question.unit_id,
        user_answer: userAnswer,
      });
      if (wrongInsertError) throw new Error(`오답 기록 저장 실패: ${wrongInsertError.message}`);
    }
  } else {
    const { error: masteredError } = await supabase
      .from("wrong_answers")
      .update({ mastered: true })
      .eq("user_id", user.id)
      .eq("question_id", questionId);
    if (masteredError) throw new Error(`오답 상태 갱신 실패: ${masteredError.message}`);

    await awardXP(supabase, 5, "숙제 정답");
  }

  revalidatePath(`/homework`);
  return { isCorrect, explanation: question.explanation as string };
}

export async function completeHomeworkIfDone(homeworkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items, error: itemsError } = await supabase
    .from("homework_items")
    .select("is_correct")
    .eq("homework_id", homeworkId);
  if (itemsError) throw new Error(`숙제 상태 조회 실패: ${itemsError.message}`);

  const list = items ?? [];
  const allAnswered = list.length > 0 && list.every((i) => i.is_correct !== null);
  if (allAnswered) {
    const { error: completionError } = await supabase
      .from("homeworks")
      .update({ status: "completed" })
      .eq("id", homeworkId)
      .eq("user_id", user.id);
    if (completionError) throw new Error(`숙제 완료 처리 실패: ${completionError.message}`);
    // 숙제 완료 수 기반 배지(homework_100) 판정
    await checkAndAwardBadges(supabase);
  }
}
