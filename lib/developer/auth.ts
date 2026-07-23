import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { isDeveloperRole, isSuperAdminRole } from "@/lib/developer/roles";

const COOKIE_NAME = "studyhub_developer_session";
const SESSION_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  return process.env.DEVELOPER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!;
}

function signature(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

export async function createDeveloperSession(userId: string) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(COOKIE_NAME, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/developer",
    maxAge: SESSION_SECONDS,
  });
}

export async function hasDeveloperSession(userId: string) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [tokenUserId, rawExpires, providedSignature, ...rest] = token.split(".");
  if (rest.length || tokenUserId !== userId || !rawExpires || !providedSignature) return false;
  const expires = Number(rawExpires);
  if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  const payload = `${tokenUserId}.${rawExpires}`;
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(providedSignature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function clearDeveloperSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function requireDeveloper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/developer/login");

  const { data: profile } = await supabase.from("profiles").select("id, nickname, role").eq("id", user.id).single();
  if (!isDeveloperRole(profile?.role)) redirect("/developer/login?error=access_denied");
  if (!await hasDeveloperSession(user.id)) redirect("/developer/login?error=special_login_required");

  return { supabase, admin: createAdminClient(), user, profile };
}

export async function requireSuperAdmin() {
  const context = await requireDeveloper();
  if (!isSuperAdminRole(context.profile.role)) redirect("/developer?error=super_admin_required");
  return context;
}

export async function writeDeveloperAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId?: string,
  details: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  let request: Record<string, string> = {};
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    request = {
      ...(forwarded ? { ip: forwarded.slice(0, 64) } : {}),
      ...(requestHeaders.get("user-agent") ? { userAgent: requestHeaders.get("user-agent")!.slice(0, 300) } : {}),
    };
  } catch {
    // Audit writes can also run outside an HTTP request.
  }
  const { error } = await admin.from("developer_audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    details: { ...details, ...(Object.keys(request).length ? { request } : {}) },
  });
  if (error && !isMissingSchemaError(error)) console.error("[developer-audit]", error.message);
}
