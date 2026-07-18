import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Server Components / Server Actions / Route Handlers에서 사용하는 Supabase 클라이언트.
 * 사용자의 세션 쿠키를 그대로 사용하므로 RLS가 정상 적용됩니다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출된 경우 무시 (middleware가 세션 갱신 처리)
          }
        },
      },
    }
  );
}

/**
 * service_role 키를 사용하는 관리자 클라이언트.
 * AI 문제 생성, 크론 작업 등 RLS를 우회해야 하는 서버 전용 작업에만 사용합니다.
 * 절대 클라이언트 컴포넌트나 API 응답에 노출하지 마세요.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
