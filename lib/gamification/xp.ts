import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * XP 지급 + 레벨 재계산 + xp_transactions 기록을 원자적으로 수행하는 DB 함수(award_xp)를 호출합니다.
 * profiles.xp/level을 직접 update하는 코드를 절대 새로 추가하지 말고, 항상 이 함수를 통해
 * XP를 지급하세요. (동시 요청 레이스 컨디션 방지 + xp_transactions 기록 누락 방지)
 */
export async function awardXP(supabase: SupabaseClient, amount: number, reason: string) {
  const { data, error } = await supabase.rpc("award_xp", { p_amount: amount, p_reason: reason }).single();

  if (error) throw new Error(`XP 지급 실패: ${error.message}`);

  return data as { new_xp: number; new_level: number; leveled_up: boolean };
}

/**
 * 연속학습일(streak)을 원자적으로 갱신하는 DB 함수(bump_streak)를 호출합니다.
 * 같은 날 두 번째 이후 호출은 아무 변화 없이 현재 streak만 반환합니다.
 */
export async function bumpStreak(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("bump_streak").single();

  if (error) throw new Error(`연속학습일 갱신 실패: ${error.message}`);

  return data as { new_streak: number; is_new_day: boolean };
}
