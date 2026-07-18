import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubjectId } from "@/types";

/**
 * 사용자의 최신 진단 결과에서 과목별 취약 단원 목록을 뽑는다. 숙제 생성
 * (ensureTodayHomework, daily-homework 크론)과 플래너 생성이 모두 같은
 * 진단 데이터를 같은 방식으로 취합해야 하므로 공유한다.
 */
export async function getWeakUnitsBySubject(
  client: SupabaseClient,
  userId: string
): Promise<{ subject: SubjectId; units: string[] }[]> {
  const { data: diagnostics } = await client
    .from("diagnostic_results")
    .select("subject_id, weak_units")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const weakBySubject = new Map<SubjectId, string[]>();
  for (const d of diagnostics ?? []) {
    if (!weakBySubject.has(d.subject_id)) {
      weakBySubject.set(d.subject_id, ((d.weak_units as { name: string }[]) ?? []).map((u) => u.name));
    }
  }

  return [...weakBySubject.entries()].map(([subject, units]) => ({ subject, units }));
}
