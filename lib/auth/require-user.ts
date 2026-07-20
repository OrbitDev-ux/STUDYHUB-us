import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/supabase/profile";
import { redirect } from "next/navigation";

/** 로그인 사용자를 요구하는 서버 액션들의 공통 진입부 — 없으면 로그인 페이지로 보낸다. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * 관리자 권한을 요구하는 페이지/액션의 공통 진입부. 로그인 여부와 profiles.role을
 * 둘 다 확인하고, 관리자가 아니면 대시보드로 돌려보낸다. 실제 데이터 변경은 항상
 * DB의 security definer 함수(is_admin() 재검증)를 거치므로 이건 UI 접근 차단용이다.
 */
export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const profile = await getCachedProfile(user.id);
  if (profile?.role !== "admin") redirect("/dashboard");
  return { supabase, user, profile };
}
