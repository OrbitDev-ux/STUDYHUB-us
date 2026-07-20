import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedPlanItem } from "@/lib/ai/planner";

/**
 * AI가 생성한 플래너 항목들을 study_plan_items에 저장한다. study_plan_items에는
 * 부모 소유권 기반 INSERT 정책이 없을 수 있으므로 service role로 저장하고,
 * 실패하면 방금 만든 study_plans 행도 함께 롤백한다 (사용자 화면과 크론이 동일한
 * 로직을 공유해야 한쪽만 고치고 다른 쪽을 놓치는 일이 없다).
 */
export async function insertStudyPlanItems(
  admin: SupabaseClient,
  planId: string,
  userId: string,
  items: GeneratedPlanItem[]
): Promise<void> {
  const { error } = await admin.from("study_plan_items").insert(
    items.map((item, idx) => ({
      plan_id: planId,
      subject_id: item.subject_id,
      title: item.title,
      planned_minutes: item.planned_minutes,
      priority: item.priority,
      type: item.type,
      order_index: idx,
    }))
  );

  if (error) {
    await admin.from("study_plans").delete().eq("id", planId).eq("user_id", userId);
    throw new Error(`플래너 항목 저장 실패: ${error.message}`);
  }
}
