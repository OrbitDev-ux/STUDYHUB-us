"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateDailyHomework } from "@/lib/ai/homework";
import { insertHomeworkItems } from "@/lib/homework/persist";
import { awardXP, checkAndAwardBadges } from "@/lib/gamification/xp";
import { todayKST } from "@/lib/utils/date";
import type { SubjectId } from "@/types";

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

  const [{ data: profile }, { data: settings }, { data: diagnostics }, { data: wrongAnswers }] = await Promise.all([
    supabase.from("profiles").select("grade_level, target_study_minutes").eq("id", user.id).single(),
    supabase.from("settings").select("homework_question_count").eq("user_id", user.id).single(),
    supabase
      .from("diagnostic_results")
      .select("subject_id, weak_units")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("wrong_answers")
      .select("subject_id, unit_id, question_id, questions(content, unit_id, units(name))")
      .eq("user_id", user.id)
      .eq("mastered", false)
      .order("last_wrong_at", { ascending: false })
      .limit(5),
  ]);

  const weakBySubject = new Map<SubjectId, string[]>();
  for (const d of diagnostics ?? []) {
    if (!weakBySubject.has(d.subject_id)) {
      weakBySubject.set(
        d.subject_id,
        ((d.weak_units as { name: string }[]) ?? []).map((u) => u.name)
      );
    }
  }

  const wrongSummaries = (wrongAnswers ?? []).map((w) => ({
    subject: w.subject_id as SubjectId,
    unit: (w.questions as unknown as { units?: { name: string } })?.units?.name ?? "기타",
    content: (w.questions as unknown as { content: string })?.content ?? "",
  }));

  const generated = await generateDailyHomework({
    gradeLevel: profile?.grade_level ?? "중2",
    weakUnitsBySubject: [...weakBySubject.entries()].map(([subject, units]) => ({ subject, units })),
    wrongQuestionSummaries: wrongSummaries,
    targetMinutes: profile?.target_study_minutes ?? 60,
    questionCount: settings?.homework_question_count ?? 10,
  });

  const admin = createAdminClient();

  const { data: homework, error: hwError } = await supabase
    .from("homeworks")
    .insert({ user_id: user.id, date: today, status: "pending", ai_rationale: generated.rationale })
    .select("id")
    .single();

  if (hwError || !homework) throw new Error(hwError?.message ?? "숙제 생성 실패");

  await insertHomeworkItems(admin, homework.id, generated.items);

  revalidatePath("/homework");
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

  await supabase
    .from("homework_items")
    .update({ user_answer: userAnswer, is_correct: isCorrect, answered_at: new Date().toISOString() })
    .eq("id", itemId);

  if (!isCorrect) {
    const { data: existingWrong } = await supabase
      .from("wrong_answers")
      .select("id, wrong_count")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingWrong) {
      await supabase
        .from("wrong_answers")
        .update({
          wrong_count: existingWrong.wrong_count + 1,
          user_answer: userAnswer,
          last_wrong_at: new Date().toISOString(),
          mastered: false,
        })
        .eq("id", existingWrong.id);
    } else {
      await supabase.from("wrong_answers").insert({
        user_id: user.id,
        question_id: questionId,
        subject_id: question.subject_id,
        unit_id: question.unit_id,
        user_answer: userAnswer,
      });
    }
  } else {
    await supabase
      .from("wrong_answers")
      .update({ mastered: true })
      .eq("user_id", user.id)
      .eq("question_id", questionId);

    await awardXP(supabase, 5, "숙제 정답");
  }

  revalidatePath(`/homework`);
  return { isCorrect, explanation: question.explanation as string };
}

export async function completeHomeworkIfDone(homeworkId: string) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("homework_items")
    .select("is_correct")
    .eq("homework_id", homeworkId);

  const list = items ?? [];
  const allAnswered = list.length > 0 && list.every((i) => i.is_correct !== null);
  if (allAnswered) {
    await supabase.from("homeworks").update({ status: "completed" }).eq("id", homeworkId);
    // 숙제 완료 수 기반 배지(homework_100) 판정
    await checkAndAwardBadges(supabase);
  }
}
