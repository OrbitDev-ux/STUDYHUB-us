import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isMaintenanceAllowedPath } from "@/lib/maintenance-access";
import { isDeveloperRole } from "@/lib/developer/roles";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const PROTECTED_PREFIXES = ["/dashboard", "/homework", "/planner", "/timer", "/wrong-notes", "/report", "/rank", "/profile", "/users", "/settings", "/onboarding", "/banned"];

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
  let accessProfile: {
    role?: string | null;
    is_banned?: boolean;
    banned_until?: string | null;
  } | null = null;
  if (user) {
    let profileResult = await supabase.from("profiles")
      .select("role,is_banned,banned_until")
      .eq("id", user.id)
      .single();
    if (profileResult.error && /column|schema cache|does not exist/i.test(profileResult.error.message)) {
      profileResult = await supabase.from("profiles").select("role").eq("id", user.id).single();
    }
    accessProfile = profileResult.data;
  }
  const isBanned = Boolean(
    accessProfile?.is_banned
    && (!accessProfile.banned_until || new Date(accessProfile.banned_until).getTime() > Date.now())
  );

  if (user && isBanned && path !== "/banned") {
    const url = request.nextUrl.clone();
    url.pathname = "/banned";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && !isBanned && path === "/banned") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 크론과 개발자 콘솔은 각각 별도 비밀키/특별 로그인으로 보호되므로 점검 중에도 통과.
  const isMaintenanceAllowed = isMaintenanceAllowedPath(path);

  if (!isMaintenanceAllowed) {
    const { data: appSettings, error: appSettingsError } = await supabase
      .from("app_settings")
      .select("maintenance_mode")
      .eq("id", true)
      .single();

    // 조회 실패 시 점검 모드를 "꺼짐"으로 간주하고 통과시킨다(fail-open) — 하지만
    // 원인 파악이 가능하도록 에러 자체는 로그로 남긴다.
    if (appSettingsError) {
      console.error("[middleware] app_settings 조회 실패:", appSettingsError.message);
    }

    if (appSettings?.maintenance_mode) {
      const isAdmin = isDeveloperRole(accessProfile?.role);

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
