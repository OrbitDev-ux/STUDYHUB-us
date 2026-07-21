import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const PROTECTED_PREFIXES = ["/dashboard", "/homework", "/planner", "/timer", "/wrong-notes", "/report", "/rank", "/profile", "/settings", "/onboarding", "/admin"];

// 점검 모드가 켜져 있어도 반드시 접근 가능해야 하는 경로.
// /login과 /api/auth/callback이 막히면 관리자조차 로그인해서 점검 모드를 끌 수 없게 된다.
const MAINTENANCE_ALLOWED = [
  "/maintenance",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/callback",
  "/api/discord/callback",
];

// app_settings.maintenance_mode는 관리자가 가끔 토글하는 값이라 매 요청마다
// DB를 조회할 필요는 없다. 미들웨어 인스턴스(웜 상태) 안에서 짧게 캐싱해서
// 트래픽이 몰릴 때 DB 부하를 줄인다 — 최대 지연은 캐시 TTL만큼이다.
const MAINTENANCE_CACHE_TTL_MS = 5000;
let maintenanceModeCache: { value: boolean; expiresAt: number } | null = null;

// Supabase가 느려지거나 잠시 응답이 없어도(무료 플랜 콜드스타트, 일시적 장애 등)
// 미들웨어가 무한정 매달리면 사이트의 모든 페이지가 똑같이 멈춘 것처럼 보인다.
// 인증 확인과 점검모드 조회 둘 다 짧게 타임아웃을 두고, 넘기면 안전한 기본값으로
// 폴백한다(로그인 안 된 것으로 간주 / 점검모드 꺼짐으로 간주).
const MIDDLEWARE_QUERY_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

async function isMaintenanceModeOn(
  supabase: ReturnType<typeof createServerClient>
): Promise<boolean> {
  if (maintenanceModeCache && maintenanceModeCache.expiresAt > Date.now()) {
    return maintenanceModeCache.value;
  }

  try {
    const { data, error } = await withTimeout(
      supabase.from("app_settings").select("maintenance_mode").eq("id", true).single(),
      MIDDLEWARE_QUERY_TIMEOUT_MS
    );

    // 조회 실패 시 점검 모드를 "꺼짐"으로 간주하고 통과시킨다(fail-open) — 하지만
    // 원인 파악이 가능하도록 에러 자체는 로그로 남긴다. 실패 결과는 캐싱하지 않아
    // 다음 요청에서 바로 다시 시도한다.
    if (error) {
      console.error("[middleware] app_settings 조회 실패:", error.message);
      return false;
    }

    const value = Boolean(data?.maintenance_mode);
    maintenanceModeCache = { value, expiresAt: Date.now() + MAINTENANCE_CACHE_TTL_MS };
    return value;
  } catch (e) {
    console.error("[middleware] app_settings 조회 타임아웃/예외:", e);
    return false;
  }
}

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

  let user = null;
  try {
    const result = await withTimeout(supabase.auth.getUser(), MIDDLEWARE_QUERY_TIMEOUT_MS);
    user = result.data.user;
  } catch (e) {
    // 인증 서버가 느리거나 응답이 없으면 로그인 안 된 것으로 간주한다 — 보호된
    // 페이지는 /login으로 보내고, 이미 로그인된 사용자는 다음 요청에서 다시 통과된다.
    console.error("[middleware] auth.getUser() 실패/타임아웃:", e);
  }

  const path = request.nextUrl.pathname;

  // 크론은 사용자 요청이 아니라 CRON_SECRET으로 별도 인증되므로 점검 모드와 무관하게 항상 통과.
  const isCron = path.startsWith("/api/cron");
  const isMaintenanceAllowed = isCron || MAINTENANCE_ALLOWED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isMaintenanceAllowed) {
    if (await isMaintenanceModeOn(supabase)) {
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
