import { createClient } from "@/lib/supabase/server";
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
