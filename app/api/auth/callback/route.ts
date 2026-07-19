import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// 외부로 리다이렉트되는 오픈 리다이렉트를 막기 위해, "/"로 시작하고 "//"(프로토콜
// 상대 URL)나 "@"(userinfo 트릭)를 포함하지 않는 내부 경로만 허용한다.
function isSafeRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("@") && !path.includes("://");
}

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

        if (profile && !profile.onboarding_completed) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
