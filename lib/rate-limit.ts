import { createAdminClient } from "@/lib/supabase/server";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * key(이메일/IP 등) 기준으로 최근 windowMs 동안의 시도 횟수가 maxAttempts 이상이면
 * true를 반환한다. 이번 시도도 함께 기록한다. auth_attempts 테이블/쿼리 자체가
 * 실패하는 경우(마이그레이션 미반영 등) 로그인/가입 자체를 막으면 안 되므로
 * fail-open(차단하지 않음)한다.
 */
export async function isRateLimited(
  key: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - windowMs).toISOString();

    const { count, error: countError } = await admin
      .from("auth_attempts")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", since);

    if (countError) {
      console.error("[rate-limit] 조회 실패, 통과 처리:", countError.message);
      return false;
    }

    const { error: insertError } = await admin.from("auth_attempts").insert({ key });
    if (insertError) console.error("[rate-limit] 기록 실패:", insertError.message);

    return (count ?? 0) >= maxAttempts;
  } catch (e) {
    console.error("[rate-limit] 예외 발생, 통과 처리:", e);
    return false;
  }
}
