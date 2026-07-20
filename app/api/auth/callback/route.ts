import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isSafeRedirectPath } from "@/lib/utils/safe-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = rawNext && isSafeRedirectPath(rawNext) ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 온보딩 완료 여부에 따라 리다이렉트 분기
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        // 비밀번호 재설정처럼 명시적으로 지정된 목적지는 온보딩 완료 여부와 무관하게
        // 항상 존중해야 한다 (아니면 온보딩을 안 끝낸 유저는 비밀번호를 재설정할 방법이 없어진다).
        if (profile && !profile.onboarding_completed && next !== "/reset-password") {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
