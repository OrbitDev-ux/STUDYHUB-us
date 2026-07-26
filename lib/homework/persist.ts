import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedHomeworkItem } from "@/lib/ai/homework";

/**
 * 과목 + 단원명으로 units 행을 찾고, 없으면 새로 만들어 id를 반환한다.
 * ensureTodayHomework(사용자 접속 시)와 daily-homework 크론이 동일한 로직을 공유해야
 * 문제가 어느 경로로 생성되든 unit_id가 항상 채워진다.
 */
export async function resolveOrCreateUnitId(
  admin: SupabaseClient,
  subjectId: string,
  unitName: string
): Promise<string | undefined> {
  const { data: unit, error: findError } = await admin
    .from("units")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("name", unitName)
    .limit(1)
    .maybeSingle();

  if (findError) throw new Error(`단원 조회 실패: ${findError.message}`);

  if (unit?.id) return unit.id as string;

  const { data: newUnit, error: insertError } = await admin
    .from("units")
    .insert({ subject_id: subjectId, name: unitName })
    .select("id")
    .single();

  if (insertError || !newUnit) throw new Error(`단원 저장 실패: ${insertError?.message ?? "unknown error"}`);

  return newUnit?.id as string | undefined;
}

/** AI가 생성한 숙제 문항들을 questions/homework_items에 저장한다 (unit_id 포함). */
export async function insertHomeworkItems(
  admin: SupabaseClient,
  homeworkId: string,
  items: GeneratedHomeworkItem[]
): Promise<void> {
  // 문항마다 순차로 왕복하면 10문제 기준 30회 이상의 요청이 발생해 페이지 로딩을
  // 막는다. (subject_id, unit_name) 조합별로 한 번만 조회/생성한 뒤 questions/
  // homework_items는 배치 insert로 한 번에 저장한다.
  const uniqueUnitKeys = new Map<string, { subjectId: string; unitName: string }>();
  for (const item of items) {
    uniqueUnitKeys.set(`${item.subject_id}::${item.unit_name}`, {
      subjectId: item.subject_id,
      unitName: item.unit_name,
    });
  }

  const unitEntries = await Promise.all(
    [...uniqueUnitKeys.entries()].map(async ([key, { subjectId, unitName }]) => {
      const unitId = await resolveOrCreateUnitId(admin, subjectId, unitName);
      return [key, unitId] as const;
    })
  );
  const unitIdByKey = new Map(unitEntries);

  const { data: questions, error: questionError } = await admin
    .from("questions")
    .insert(
      items.map((item) => ({
        subject_id: item.subject_id,
        unit_id: unitIdByKey.get(`${item.subject_id}::${item.unit_name}`),
        type: item.type,
        difficulty: item.difficulty,
        content: item.content,
        choices: item.choices,
        answer: item.answer,
        explanation: item.explanation,
        source: "ai_generated",
      }))
    )
    .select("id");

  if (questionError || !questions || questions.length !== items.length) {
    throw new Error(`숙제 문제 저장 실패: ${questionError?.message ?? "unknown error"}`);
  }

  const { error: itemError } = await admin.from("homework_items").insert(
    items.map((item, i) => ({
      homework_id: homeworkId,
      question_id: questions[i]!.id,
      subject_id: item.subject_id,
      category: item.category,
      order_index: i,
    }))
  );
  if (itemError) throw new Error(`숙제 항목 저장 실패: ${itemError.message}`);
}
