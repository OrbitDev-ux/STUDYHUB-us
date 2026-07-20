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

const unitKey = (subjectId: string, unitName: string) => `${subjectId}::${unitName}`;

/**
 * 여러 (subject_id, unit_name) 쌍의 unit_id를 한 번의 조회(+필요 시 한 번의 insert)로
 * 벌크 해석한다. resolveOrCreateUnitId를 항목마다 순차 호출하면 숙제 세트 하나당
 * 왕복이 항목 수만큼 늘어나므로, 문제 저장 전에 필요한 단원을 미리 다 확보해둔다.
 */
async function resolveUnitIds(
  admin: SupabaseClient,
  pairs: { subjectId: string; unitName: string }[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Map(pairs.map((p) => [unitKey(p.subjectId, p.unitName), p])).values());
  const resolved = new Map<string, string>();
  if (unique.length === 0) return resolved;

  const subjectIds = [...new Set(unique.map((p) => p.subjectId))];
  const unitNames = [...new Set(unique.map((p) => p.unitName))];

  const { data: existing, error: findError } = await admin
    .from("units")
    .select("id, subject_id, name")
    .in("subject_id", subjectIds)
    .in("name", unitNames);
  if (findError) throw new Error(`단원 조회 실패: ${findError.message}`);

  for (const u of existing ?? []) {
    resolved.set(unitKey(u.subject_id as string, u.name as string), u.id as string);
  }

  const missing = unique.filter((p) => !resolved.has(unitKey(p.subjectId, p.unitName)));
  if (missing.length > 0) {
    const { data: created, error: insertError } = await admin
      .from("units")
      .insert(missing.map((p) => ({ subject_id: p.subjectId, name: p.unitName })))
      .select("id, subject_id, name");
    if (insertError) throw new Error(`단원 저장 실패: ${insertError.message}`);

    for (const u of created ?? []) {
      resolved.set(unitKey(u.subject_id as string, u.name as string), u.id as string);
    }
  }

  return resolved;
}

/**
 * AI가 생성한 숙제 문항들을 questions/homework_items에 저장한다 (unit_id 포함).
 * 단원 해석 → questions 벌크 insert → homework_items 벌크 insert 순으로 처리해,
 * 항목당 여러 번 왕복하던 것을 세트당 최대 3번의 쿼리로 줄인다.
 */
export async function insertHomeworkItems(
  admin: SupabaseClient,
  homeworkId: string,
  items: GeneratedHomeworkItem[]
): Promise<void> {
  if (items.length === 0) return;

  const unitIdByKey = await resolveUnitIds(
    admin,
    items.map((item) => ({ subjectId: item.subject_id, unitName: item.unit_name }))
  );

  const { data: questions, error: questionsError } = await admin
    .from("questions")
    .insert(
      items.map((item) => ({
        subject_id: item.subject_id,
        unit_id: unitIdByKey.get(unitKey(item.subject_id, item.unit_name)),
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

  if (questionsError || !questions || questions.length !== items.length) {
    throw new Error(`숙제 문제 저장 실패: ${questionsError?.message ?? "unknown error"}`);
  }

  // 바로 위에서 questions.length === items.length를 확인했으므로 인덱스는 항상 유효하다.
  const { error: itemsError } = await admin.from("homework_items").insert(
    items.map((item, i) => ({
      homework_id: homeworkId,
      question_id: questions[i]!.id,
      subject_id: item.subject_id,
      category: item.category,
      order_index: i,
    }))
  );
  if (itemsError) throw new Error(`숙제 항목 저장 실패: ${itemsError.message}`);
}
