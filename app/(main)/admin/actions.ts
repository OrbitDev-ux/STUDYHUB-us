"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-user";
import { revalidatePath } from "next/cache";
import { notifyMaintenanceModeChange } from "@/lib/discord/webhook";
import { isPlan } from "@/lib/plan";
import type { AdminStats, AdminUserSummary, AdminUserSearchResult } from "@/types";

/** 대시보드 개요용 집계 통계. get_admin_stats() RPC 자체가 admin 권한을 재검증한다. */
export async function getAdminStats(): Promise<AdminStats> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("get_admin_stats");
  if (error) throw new Error(`통계 조회 실패: ${error.message}`);
  return data as AdminStats;
}

/** 최근 가입한 회원 목록 (회원 관리 페이지의 기본 목록). */
export async function listRecentUsers(limit = 20): Promise<AdminUserSummary[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, nickname, grade_level, plan, role, level, streak_days, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`회원 목록 조회 실패: ${error.message}`);
  return (data ?? []) as AdminUserSummary[];
}

/**
 * 이메일로 사용자를 찾아 관리 화면에 필요한 정보를 반환한다.
 * service_role로 auth.users를 조회해야 하므로 admin 클라이언트를 쓴다.
 */
export async function findUserByEmail(email: string): Promise<AdminUserSearchResult | null> {
  await requireAdmin();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;

  const admin = createAdminClient();
  // Admin Auth API에 이메일 직접 필터가 없어 페이지를 넘기며 직접 매칭한다.
  // (유저 수가 훨씬 많아지면 profiles에 email 컬럼을 추가하는 방식으로 바꿔야 한다.)
  const perPage = 1000;
  let authUser: { id: string; email?: string } | undefined;
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage });
    authUser = data?.users.find((u) => u.email?.toLowerCase() === trimmed);
    if (authUser || !data || data.users.length < perPage) break;
  }
  if (!authUser) return null;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("nickname, plan, role")
    .eq("id", authUser.id)
    .single();
  if (profileError) throw new Error(`사용자 프로필 조회 실패: ${profileError.message}`);
  if (!profile) return null;

  return {
    id: authUser.id,
    nickname: profile.nickname,
    plan: profile.plan,
    role: profile.role,
    email: authUser.email ?? "",
  };
}

/** 특정 유저의 플랜 변경. DB의 set_user_plan()이 관리자 권한을 다시 검증한다. */
export async function setUserPlan(targetUserId: string, plan: string) {
  const { supabase } = await requireAdmin();
  if (!isPlan(plan)) throw new Error("잘못된 플랜입니다.");

  const { error } = await supabase.rpc("set_user_plan", { p_target_user_id: targetUserId, p_plan: plan });
  if (error) throw new Error(`플랜 변경 실패: ${error.message}`);

  revalidatePath("/admin/users");
}

/** 특정 유저의 role(user/admin) 변경. DB의 set_user_role()이 관리자 권한과 셀프 강등을 다시 검증한다. */
export async function setUserRole(targetUserId: string, role: "user" | "admin") {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("set_user_role", { p_target_user_id: targetUserId, p_role: role });
  if (error) throw new Error(`권한 변경 실패: ${error.message}`);

  revalidatePath("/admin/users");
}

/** 점검 모드 on/off. DB의 set_maintenance_mode()가 관리자 권한을 다시 검증한다. */
export async function setMaintenanceMode(formData: FormData) {
  const { supabase } = await requireAdmin();

  const enabled = formData.get("enabled") === "on";
  const message = String(formData.get("message") ?? "").trim() || null;

  const { error } = await supabase.rpc("set_maintenance_mode", { p_enabled: enabled, p_message: message });
  if (error) throw new Error(`점검 모드 변경 실패: ${error.message}`);

  await notifyMaintenanceModeChange(enabled, message);

  revalidatePath("/admin/site");
  revalidatePath("/admin");
}
