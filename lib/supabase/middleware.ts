import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const PROTECTED_PREFIXES = ["/dashboard", "/homework", "/planner", "/timer", "/wrong-notes", "/report", "/rank", "/profile", "/settings", "/onboarding"];

// 점검 모드가 켜져 있어도 반드시 접근 가능해야 하는 경로.
// /login과 /api/auth/callback이 막히면 관리자조차 로그인해서 점검 모드를 끌 수 없게 된다.
const MAINTENANCE_ALLOWED = ["/maintenance", "/login", "/api/auth/callback", "/api/discord/callback"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // 크론은 사용자 요청이 아니라 CRON_SECRET으로 별도 인증되므로 점검 모드와 무관하게 항상 통과.
  const isCron = path.startsWith("/api/cron");
  const isMaintenanceAllowed = isCron || MAINTENANCE_ALLOWED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isMaintenanceAllowed) {
    const { data: appSettings } = await supabase.from("app_settings").select("maintenance_mode").eq("id", true).single();

    if (appSettings?.maintenance_mode) {
      let isAdmin = false;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        isAdmin = profile?.role === "admin";
      }

      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/maintenance";
        return NextResponse.redirect(url);
      }
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
