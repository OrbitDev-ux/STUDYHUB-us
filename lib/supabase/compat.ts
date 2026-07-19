import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlan, type Plan } from "@/lib/plan";

/**
 * 운영 DB에 최신 마이그레이션이 아직 반영되지 않은 동안에도 무료 플랜으로 안전하게
 * 동작하게 한다. PostgreSQL의 undefined_column 코드는 42703이다.
 */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42703" || error?.message?.includes("does not exist") === true;
}

export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data, error } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();

  if (isMissingColumnError(error)) return "free";
  if (error) throw new Error(`플랜 조회 실패: ${error.message}`);
  return data?.plan != null && isPlan(String(data.plan)) ? (data.plan as Plan) : "free";
}

export async function getHomeworkQuestionCount(
  supabase: SupabaseClient,
  userId: string,
  fallback = 10
): Promise<number> {
  const { data, error } = await supabase
    .from("settings")
    .select("homework_question_count")
    .eq("user_id", userId)
    .maybeSingle();

  if (isMissingColumnError(error)) return fallback;
  if (error) throw new Error(`숙제 문항 수 조회 실패: ${error.message}`);
  const value = Number(data?.homework_question_count ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}
