import { createAdminClient } from "@/lib/supabase/server";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * key(이메일/IP 등) 기준으로 최근 windowMs 동안의 시도 횟수가 maxAttempts 이상이면
 * true를 반환한다. 이번 시도도 함께 기록한다. 조회+기록은 DB의 check_and_record_attempt()
 * RPC 안에서 advisory lock으로 직렬화되어, 동시 요청 버스트로 제한이 우회되지 않는다.
 * auth_attempts 테이블/RPC 자체가 실패하는 경우(마이그레이션 미반영 등) 로그인/가입
 * 자체를 막으면 안 되므로 fail-open(차단하지 않음)한다.
 */
export async function isRateLimited(
  key: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_and_record_attempt", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_ms: windowMs,
    });

    if (error) {
      console.error("[rate-limit] RPC 실패, 통과 처리:", error.message);
      return false;
    }

    return data === true;
  } catch (e) {
    console.error("[rate-limit] 예외 발생, 통과 처리:", e);
    return false;
  }
}
