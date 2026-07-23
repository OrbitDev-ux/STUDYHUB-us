"use server";

import { randomInt, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearDeveloperSession, createDeveloperSession, requireDeveloper, requireSuperAdmin, writeDeveloperAudit } from "@/lib/developer/auth";
import { generatePracticeSet, isGradeLevel } from "@/lib/practice/question-bank";
import { isRateLimited } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import type { SubjectId } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyMaintenanceModeChange } from "@/lib/discord/webhook";
import { isDeveloperRole, isSuperAdminRole, isUserRole } from "@/lib/developer/roles";

const SUBJECTS: SubjectId[] = ["math", "english", "social", "science"];
const UUID = /^[0-9a-f-]{36}$/i;

function safeEqual(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function developerLogin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const accessCode = String(formData.get("access_code") ?? "");
  if (!email || !password) redirect("/developer/login?error=missing_fields");
  if (await isRateLimited(`developer-login:${email}`, 5, 15 * 60 * 1000)) {
    redirect("/developer/login?error=rate_limited");
  }

  const configuredCode = process.env.DEVELOPER_ACCESS_CODE;
  if (configuredCode && !safeEqual(accessCode, configuredCode)) {
    redirect("/developer/login?error=invalid_credentials");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/developer/login?error=invalid_credentials");
  const modernProfile = await supabase.from("profiles")
    .select("role,is_banned,banned_until")
    .eq("id", data.user.id)
    .single();
  const profile = modernProfile.error && isMissingSchemaError(modernProfile.error)
    ? (await supabase.from("profiles").select("role").eq("id", data.user.id).single()).data
    : modernProfile.data;
  const banState = profile as { is_banned?: boolean; banned_until?: string | null } | null;
  const isBanned = Boolean(
    banState?.is_banned
    && (!banState.banned_until || new Date(banState.banned_until).getTime() > Date.now())
  );
  if (!isDeveloperRole(profile?.role) || isBanned) {
    await supabase.auth.signOut();
    redirect("/developer/login?error=access_denied");
  }
  await createDeveloperSession(data.user.id);
  await writeDeveloperAudit(data.user.id, "developer.login", "session");
  redirect("/developer");
}

export async function developerLogout() {
  const { supabase, user } = await requireDeveloper();
  await writeDeveloperAudit(user.id, "developer.logout", "session");
  await clearDeveloperSession();
  await supabase.auth.signOut();
  redirect("/developer/login");
}

export async function setDeveloperMaintenanceMode(formData: FormData) {
  const { supabase, user } = await requireDeveloper();
  const enabled = formData.get("enabled") === "on";
  const message = String(formData.get("message") ?? "").trim().slice(0, 500) || null;
  const { error } = await supabase.rpc("set_maintenance_mode", { p_enabled: enabled, p_message: message });
  if (error) {
    console.error("[developer-system] maintenance update failed:", error.message);
    redirect("/developer?error=maintenance_failed");
  }
  await notifyMaintenanceModeChange(enabled, message);
  await writeDeveloperAudit(user.id, "system.maintenance", "system", undefined, { enabled, message });
  revalidatePath("/developer");
  redirect("/developer?updated=maintenance");
}

function questionPayload(formData: FormData) {
  const subjectId = String(formData.get("subject_id") ?? "") as SubjectId;
  const gradeLevel = String(formData.get("grade_level") ?? "");
  const unitName = String(formData.get("unit_name") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const explanation = String(formData.get("explanation") ?? "").trim();
  const difficulty = Math.round(Number(formData.get("difficulty") ?? 2));
  const status = String(formData.get("status") ?? "draft");
  const choices = formData.getAll("choice").map(String).map((choice) => choice.trim()).filter(Boolean);
  if (!SUBJECTS.includes(subjectId) || !isGradeLevel(gradeLevel) || unitName.length > 100
    || content.length < 2 || content.length > 5000 || explanation.length > 5000
    || difficulty < 1 || difficulty > 5 || !["draft", "published"].includes(status)
    || choices.length < 2 || choices.length > 6 || new Set(choices).size !== choices.length
    || !choices.includes(answer)) {
    throw new Error("문제 입력값을 확인해주세요. 정답은 보기 중 하나와 정확히 일치해야 합니다.");
  }
  return {
    subject_id: subjectId,
    grade_level: gradeLevel,
    unit_name: unitName || "직접 출제",
    type: "multiple_choice",
    difficulty,
    content,
    choices,
    answer,
    explanation,
    status,
    source: "developer",
    updated_at: new Date().toISOString(),
  };
}

export async function saveDeveloperQuestion(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const id = String(formData.get("id") ?? "");
  let payload: ReturnType<typeof questionPayload>;
  try {
    payload = questionPayload(formData);
  } catch {
    redirect("/developer/questions?error=invalid_question");
  }
  let compatibilityMode = false;
  if (id) {
    if (!UUID.test(id)) redirect("/developer/questions?error=invalid_question_id");
    const { error } = await admin.from("questions").update(payload).eq("id", id);
    if (error && isMissingSchemaError(error)) {
      compatibilityMode = true;
      let unitId: string;
      try {
        unitId = await getOrCreateLegacyUnit(admin, payload.subject_id, payload.grade_level, payload.unit_name);
      } catch (unitError) {
        console.error("[developer-question] unit resolution failed:", unitError);
        redirect("/developer/questions?error=question_save_failed");
      }
      const { error: legacyError } = await admin.from("questions").update({
        subject_id: payload.subject_id,
        unit_id: unitId,
        type: payload.type,
        difficulty: payload.difficulty,
        content: payload.content,
        choices: payload.choices,
        answer: payload.answer,
        explanation: payload.explanation,
        source: `developer:${payload.status}`,
      }).eq("id", id);
      if (legacyError) {
        console.error("[developer-question] compatibility update failed:", legacyError.message);
        redirect("/developer/questions?error=question_save_failed");
      }
    } else if (error) {
      console.error("[developer-question] update failed:", error.message);
      redirect("/developer/questions?error=question_save_failed");
    }
    await writeDeveloperAudit(user.id, "question.update", "question", id, { status: payload.status });
  } else {
    const { data, error } = await admin.from("questions").insert({ ...payload, created_by: user.id }).select("id").single();
    let createdId = data?.id;
    if (error && isMissingSchemaError(error)) {
      compatibilityMode = true;
      let unitId: string;
      try {
        unitId = await getOrCreateLegacyUnit(admin, payload.subject_id, payload.grade_level, payload.unit_name);
      } catch (unitError) {
        console.error("[developer-question] unit resolution failed:", unitError);
        redirect("/developer/questions?error=question_save_failed");
      }
      const { data: legacy, error: legacyError } = await admin.from("questions").insert({
        subject_id: payload.subject_id,
        unit_id: unitId,
        type: payload.type,
        difficulty: payload.difficulty,
        content: payload.content,
        choices: payload.choices,
        answer: payload.answer,
        explanation: payload.explanation,
        source: `developer:${payload.status}`,
      }).select("id").single();
      if (legacyError || !legacy) {
        console.error("[developer-question] compatibility create failed:", legacyError?.message);
        redirect("/developer/questions?error=question_save_failed");
      }
      createdId = legacy.id;
    } else if (error || !data) {
      console.error("[developer-question] create failed:", error?.message);
      redirect("/developer/questions?error=question_save_failed");
    }
    await writeDeveloperAudit(user.id, "question.create", "question", createdId, { status: payload.status });
  }
  revalidatePath("/developer/questions");
  redirect(`/developer/questions?saved=1${compatibilityMode ? "&compat=1" : ""}`);
}

export async function setDeveloperQuestionStatus(questionId: string, status: "draft" | "published" | "archived") {
  const { admin, user } = await requireDeveloper();
  if (!UUID.test(questionId) || !["draft", "published", "archived"].includes(status)) redirect("/developer/questions?error=invalid_question_id");
  const { error } = await admin.from("questions").update({ status, updated_at: new Date().toISOString() }).eq("id", questionId);
  let compatibilityMode = false;
  if (error && isMissingSchemaError(error)) {
    compatibilityMode = true;
    const { error: legacyError } = await admin.from("questions").update({ source: `developer:${status}` }).eq("id", questionId);
    if (legacyError) {
      console.error("[developer-question] compatibility status failed:", legacyError.message);
      redirect("/developer/questions?error=question_status_failed");
    }
  } else if (error) {
    console.error("[developer-question] status failed:", error.message);
    redirect("/developer/questions?error=question_status_failed");
  }
  await writeDeveloperAudit(user.id, `question.${status}`, "question", questionId);
  revalidatePath("/developer/questions");
  redirect(`/developer/questions?updated=status${compatibilityMode ? "&compat=1" : ""}`);
}

async function getOrCreateLegacyUnit(
  admin: SupabaseClient,
  subjectId: SubjectId,
  gradeLevel: string,
  name: string,
) {
  const { data: existing } = await admin.from("units").select("id")
    .eq("subject_id", subjectId).eq("grade_level", gradeLevel).eq("name", name).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin.from("units").insert({
    subject_id: subjectId,
    grade_level: gradeLevel,
    name,
    order_index: 9999,
  }).select("id").single();
  if (error || !data) throw new Error(`단원 생성 실패: ${error?.message ?? "unknown"}`);
  return data.id;
}

export async function createDeveloperContest(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const gradeLevel = String(formData.get("grade_level") ?? "");
  const subjectId = String(formData.get("subject_id") ?? "") as SubjectId;
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const duration = Math.min(360, Math.max(5, Math.round(Number(formData.get("duration_minutes") ?? 60))));
  const publicationStatus = formData.get("publish_now") === "on" ? "published" : "draft";
  const isRated = formData.get("is_rated") === "on";
  const startsAt = new Date(`${startsAtRaw}:00+09:00`);
  if (title.length < 2 || title.length > 100 || description.length > 2000 || !isGradeLevel(gradeLevel)
    || !SUBJECTS.includes(subjectId) || Number.isNaN(startsAt.getTime())
    || startsAt.getTime() <= Date.now()) redirect("/developer/contests?error=invalid_contest");

  const requestedIds = formData.getAll("question_id").map(String).filter((id) => UUID.test(id)).slice(0, 16);
  let selectedIds: string[] = [];
  if (requestedIds.length) {
    const modernSelection = await admin.from("questions").select("id").in("id", requestedIds)
      .eq("status", "published").eq("grade_level", gradeLevel).eq("subject_id", subjectId);
    if (!modernSelection.error) {
      selectedIds = (modernSelection.data ?? []).map((row) => row.id);
    } else if (isMissingSchemaError(modernSelection.error)) {
      const { data: legacySelection } = await admin.from("questions")
        .select("id, units!inner(grade_level)").in("id", requestedIds)
        .eq("source", "developer:published").eq("subject_id", subjectId).eq("units.grade_level", gradeLevel);
      selectedIds = (legacySelection ?? []).map((row) => row.id);
    }
    if (selectedIds.length !== requestedIds.length) redirect("/developer/contests?error=invalid_questions");
  } else {
    const modernSelection = await admin.from("questions").select("id").eq("status", "published")
      .eq("grade_level", gradeLevel).eq("subject_id", subjectId).order("created_at", { ascending: false }).limit(10);
    if (!modernSelection.error) {
      selectedIds = (modernSelection.data ?? []).map((row) => row.id);
    } else if (isMissingSchemaError(modernSelection.error)) {
      const { data: legacySelection } = await admin.from("questions")
        .select("id, units!inner(grade_level)").eq("source", "developer:published")
        .eq("subject_id", subjectId).eq("units.grade_level", gradeLevel)
        .order("created_at", { ascending: false }).limit(10);
      selectedIds = (legacySelection ?? []).map((row) => row.id);
    }
  }

  const keys = selectedIds.map((id) => `db:${id}`);
  const generated = generatePracticeSet(gradeLevel, subjectId).map((question) => question.key);
  for (let index = generated.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [generated[index], generated[other]] = [generated[other]!, generated[index]!];
  }
  const targetCount = requestedIds.length ? Math.max(5, requestedIds.length) : 10;
  for (const key of generated) {
    if (keys.length >= targetCount) break;
    keys.push(key);
  }
  if (keys.length < 5 || keys.length > 16) redirect("/developer/contests?error=invalid_questions");

  const contestPayload = {
    title,
    description,
    grade_level: gradeLevel,
    subject_id: subjectId,
    question_keys: keys,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + duration * 60000).toISOString(),
    created_by: user.id,
    publication_status: publicationStatus,
    is_rated: isRated,
  };
  const { data, error } = await admin.from("contests").insert(contestPayload).select("id").single();
  let createdId = data?.id;
  let compatibilityMode = false;
  if (error && isMissingSchemaError(error)) {
    if (publicationStatus === "draft") redirect("/developer/contests?error=draft_requires_upgrade");
    compatibilityMode = true;
    const { publication_status: _publicationStatus, ...legacyPayload } = contestPayload;
    const { data: legacy, error: legacyError } = await admin.from("contests").insert(legacyPayload).select("id").single();
    if (legacyError || !legacy) {
      console.error("[developer-contest] compatibility create failed:", legacyError?.message);
      redirect("/developer/contests?error=contest_create_failed");
    }
    createdId = legacy.id;
  } else if (error || !data) {
    console.error("[developer-contest] create failed:", error?.message);
    redirect("/developer/contests?error=contest_create_failed");
  }
  await writeDeveloperAudit(user.id, "contest.create", "contest", createdId, {
    contestMode: "quiz", publicationStatus, isRated, questionCount: keys.length,
  });
  revalidatePath("/developer/contests");
  revalidatePath("/contests");
  redirect(`/developer/contests?created=${createdId}${compatibilityMode ? "&compat=1" : ""}`);
}

export async function createDeveloperCodingContest(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const gradeLevel = String(formData.get("grade_level") ?? "");
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const duration = Math.min(360, Math.max(5, Math.round(Number(formData.get("duration_minutes") ?? 60))));
  const publicationStatus = formData.get("publish_now") === "on" ? "published" : "draft";
  const isRated = formData.get("is_rated") === "on";
  const startsAt = new Date(`${startsAtRaw}:00+09:00`);
  const requestedIds = [...new Set(formData.getAll("judge_problem_id").map(String).filter((id) => UUID.test(id)))].slice(0, 16);
  if (title.length < 2 || title.length > 100 || description.length > 2000
    || !isGradeLevel(gradeLevel) || Number.isNaN(startsAt.getTime())
    || startsAt.getTime() <= Date.now()
    || requestedIds.length < 1) {
    redirect("/developer/contests?error=invalid_coding_contest");
  }
  const { data: problems, error: problemError } = await admin.from("oj_problems")
    .select("id,grade_level").in("id", requestedIds).eq("status", "published");
  if (problemError && isMissingSchemaError(problemError)) {
    redirect("/developer/contests?error=coding_contest_migration");
  }
  if (problemError || !problems || problems.length !== requestedIds.length
    || problems.some((problem) => problem.grade_level && problem.grade_level !== gradeLevel)) {
    redirect("/developer/contests?error=invalid_coding_problems");
  }
  const { data, error } = await admin.from("contests").insert({
    title,
    description,
    grade_level: gradeLevel,
    subject_id: "math",
    question_keys: [],
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
    created_by: user.id,
    publication_status: publicationStatus,
    is_rated: isRated,
    contest_mode: "output_judge",
    judge_problem_ids: requestedIds,
  }).select("id").single();
  if (error || !data) {
    console.error("[developer-contest] coding create failed:", error?.message);
    if (isMissingSchemaError(error)) redirect("/developer/contests?error=coding_contest_migration");
    redirect("/developer/contests?error=contest_create_failed");
  }
  await writeDeveloperAudit(user.id, "contest.create", "contest", data.id, {
    contestMode: "output_judge",
    publicationStatus,
    isRated,
    judgeProblemCount: requestedIds.length,
    judgeProblemIds: requestedIds,
  });
  revalidatePath("/developer/contests");
  revalidatePath("/contests");
  redirect(`/developer/contests?created=${data.id}`);
}

export async function updateDeveloperContest(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const contestId = String(formData.get("contest_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const duration = Math.min(360, Math.max(5, Math.round(Number(formData.get("duration_minutes") ?? 60))));
  const startsAt = new Date(`${startsAtRaw}:00+09:00`);
  const isRated = formData.get("is_rated") === "on";
  if (!UUID.test(contestId) || title.length < 2 || title.length > 100
    || description.length > 2000 || Number.isNaN(startsAt.getTime())
    || startsAt.getTime() <= Date.now()) {
    redirect("/developer/contests?error=invalid_contest");
  }
  const { data: existing } = await admin.from("contests")
    .select("*")
    .eq("id", contestId).maybeSingle();
  if (!existing || new Date(existing.starts_at).getTime() <= Date.now()) {
    redirect("/developer/contests?error=contest_edit_closed");
  }
  const updates: Record<string, unknown> = {
    title,
    description,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
    is_rated: isRated,
    updated_at: new Date().toISOString(),
  };
  if (formData.get("problem_selection") === "1") {
    if (existing.contest_mode === "output_judge") {
      const problemIds = [...new Set(formData.getAll("judge_problem_id").map(String).filter((id) => UUID.test(id)))].slice(0, 16);
      if (problemIds.length < 1) redirect("/developer/contests?error=invalid_coding_problems");
      const { data: problems } = await admin.from("oj_problems")
        .select("id,grade_level").in("id", problemIds).eq("status", "published");
      if (!problems || problems.length !== problemIds.length
        || problems.some((problem) => problem.grade_level && problem.grade_level !== existing.grade_level)) {
        redirect("/developer/contests?error=invalid_coding_problems");
      }
      updates.judge_problem_ids = problemIds;
    } else {
      const questionIds = [...new Set(formData.getAll("question_id").map(String).filter((id) => UUID.test(id)))].slice(0, 16);
      if (questionIds.length < 5) redirect("/developer/contests?error=invalid_questions");
      const { data: questions } = await admin.from("questions")
        .select("id,grade_level,subject_id").in("id", questionIds).eq("status", "published");
      if (!questions || questions.length !== questionIds.length
        || questions.some((question) => question.grade_level !== existing.grade_level || question.subject_id !== existing.subject_id)) {
        redirect("/developer/contests?error=invalid_questions");
      }
      updates.question_keys = questionIds.map((questionId) => `db:${questionId}`);
    }
  }
  const { error } = await admin.from("contests").update(updates).eq("id", contestId);
  if (error) {
    console.error("[developer-contest] update failed:", error.message);
    redirect("/developer/contests?error=contest_edit_failed");
  }
  await writeDeveloperAudit(user.id, "contest.update", "contest", contestId, {
    before: existing,
    after: updates,
  });
  revalidatePath("/developer/contests");
  revalidatePath("/contests");
  revalidatePath(`/contests/${contestId}`);
  redirect("/developer/contests?updated=edit");
}

export async function setDeveloperContestStatus(contestId: string, status: "draft" | "published" | "cancelled") {
  const { admin, user } = await requireDeveloper();
  if (!UUID.test(contestId) || !["draft", "published", "cancelled"].includes(status)) redirect("/developer/contests?error=invalid_contest_id");
  const { error } = await admin.from("contests").update({
    publication_status: status,
    updated_at: new Date().toISOString(),
  }).eq("id", contestId);
  if (error && isMissingSchemaError(error)) redirect("/developer/contests?error=publishing_requires_upgrade");
  if (error) {
    console.error("[developer-contest] status failed:", error.message);
    redirect("/developer/contests?error=contest_status_failed");
  }
  await writeDeveloperAudit(user.id, `contest.${status}`, "contest", contestId);
  revalidatePath("/developer/contests");
  revalidatePath("/contests");
  redirect("/developer/contests?updated=status");
}

export async function finishDeveloperContest(contestId: string) {
  const { admin, user } = await requireDeveloper();
  if (!UUID.test(contestId)) redirect("/developer/contests?error=invalid_contest_id");
  const [{ data: contest }, { data: registrations }] = await Promise.all([
    admin.from("contests").select("starts_at").eq("id", contestId).single(),
    admin.from("contest_entries").select("participation_mode").eq("contest_id", contestId),
  ]);
  if (!contest || new Date(contest.starts_at).getTime() >= Date.now()) redirect("/developer/contests?error=contest_not_started");
  const { error } = await admin.from("contests").update({ ends_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", contestId);
  if (error) {
    console.error("[developer-contest] finish failed:", error.message);
    redirect("/developer/contests?error=contest_finish_failed");
  }
  const ratedCount = (registrations ?? []).filter((entry) => entry.participation_mode !== "unrated").length;
  const unratedCount = (registrations ?? []).filter((entry) => entry.participation_mode === "unrated").length;
  await writeDeveloperAudit(user.id, "contest.finish", "contest", contestId, {
    registeredCount: ratedCount + unratedCount,
    ratedCount,
    unratedCount,
  });
  await admin.rpc("finalize_contest_ratings", { p_contest_id: contestId });
  revalidatePath("/developer/contests");
  revalidatePath(`/contests/${contestId}`);
  revalidatePath(`/contests/${contestId}/standings`);
  redirect("/developer/contests?updated=finished");
}

export async function updateDeveloperUser(formData: FormData) {
  const { supabase, admin, user, profile: actorProfile } = await requireDeveloper();
  const targetId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "user");
  const plan = String(formData.get("plan") ?? "free");
  const roleReason = String(formData.get("role_reason") ?? "").trim();
  if (!UUID.test(targetId) || !isUserRole(role) || !["free", "basic", "pro"].includes(plan)) {
    redirect("/developer/users?error=invalid_user_settings");
  }
  const { data: target } = await admin.from("profiles").select("role").eq("id", targetId).maybeSingle();
  if (!target) redirect("/developer/users?error=invalid_user_settings");
  const roleChanged = target.role !== role;

  if (roleChanged) {
    if (!isSuperAdminRole(actorProfile.role)) redirect("/developer/users?error=super_admin_required");
    if (roleReason.length < 5 || roleReason.length > 300) redirect("/developer/users?error=invalid_role_reason");
    if (targetId === user.id && role !== "super_admin") redirect("/developer/users?error=self_demotion");
    const { data: roleResult, error: roleError } = await supabase.rpc("super_admin_set_user_role", {
      p_target_user_id: targetId,
      p_role: role,
      p_reason: roleReason,
    });
    if (roleError) {
      console.error("[developer-user] role update failed:", roleError.message);
      if (/at least one|current super admin/i.test(roleError.message)) {
        redirect("/developer/users?error=last_super_admin");
      }
      if (isMissingSchemaError(roleError)) redirect("/developer/users?error=super_admin_migration_required");
      redirect("/developer/users?error=user_update_failed");
    }
    await writeDeveloperAudit(user.id, "user.role.update", "user", targetId, {
      ...(roleResult && typeof roleResult === "object" ? roleResult as Record<string, unknown> : {}),
      reason: roleReason,
    });
  }

  const { error } = await admin.from("profiles")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", targetId);
  if (error) {
    console.error("[developer-user] update failed:", error.message);
    redirect("/developer/users?error=user_update_failed");
  }
  await writeDeveloperAudit(user.id, "user.update", "user", targetId, { role, plan, roleChanged });
  revalidatePath("/developer/users");
  redirect("/developer/users?updated=user");
}

export async function setSuperAdminUserBan(formData: FormData) {
  const { supabase, user } = await requireSuperAdmin();
  const targetId = String(formData.get("user_id") ?? "");
  const banned = String(formData.get("banned") ?? "") === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  const untilRaw = String(formData.get("banned_until") ?? "").trim();
  if (!UUID.test(targetId) || targetId === user.id || reason.length < 5 || reason.length > 500) {
    redirect("/developer/users?error=invalid_ban");
  }
  let bannedUntil: string | null = null;
  if (banned && untilRaw) {
    const parsed = new Date(`${untilRaw}:00+09:00`);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      redirect("/developer/users?error=invalid_ban_expiry");
    }
    bannedUntil = parsed.toISOString();
  }

  const { data, error } = await supabase.rpc("super_admin_set_user_ban", {
    p_target_user_id: targetId,
    p_banned: banned,
    p_reason: reason,
    p_banned_until: bannedUntil,
  });
  if (error) {
    console.error("[super-admin-user] ban update failed:", error.message);
    if (/current super admin|at least one/i.test(error.message)) {
      redirect("/developer/users?error=protected_operator");
    }
    if (isMissingSchemaError(error)) redirect("/developer/users?error=moderation_migration_required");
    redirect("/developer/users?error=ban_update_failed");
  }
  await writeDeveloperAudit(user.id, banned ? "user.ban" : "user.unban", "user", targetId, {
    ...(data && typeof data === "object" ? data as Record<string, unknown> : {}),
    reason,
    bannedUntil,
  });
  revalidatePath("/developer/users");
  revalidatePath("/rank");
  revalidatePath("/battle");
  revalidatePath(`/users/${targetId}`);
  redirect(`/developer/users?updated=${banned ? "banned" : "unbanned"}`);
}

export async function deleteSuperAdminUser(formData: FormData) {
  const { admin, user } = await requireSuperAdmin();
  const targetId = String(formData.get("user_id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(targetId) || targetId === user.id || reason.length < 5 || reason.length > 500) {
    redirect("/developer/users?error=invalid_user_deletion");
  }

  let targetResult = await admin.from("profiles")
    .select("id,nickname,role,plan,grade_level,created_at,is_banned,banned_at,banned_until,ban_reason")
    .eq("id", targetId)
    .maybeSingle();
  if (targetResult.error && isMissingSchemaError(targetResult.error)) {
    targetResult = await admin.from("profiles")
      .select("id,nickname,role,plan,grade_level,created_at")
      .eq("id", targetId)
      .maybeSingle();
  }
  const { data: target } = targetResult;
  const { data: rating } = await admin.from("battle_ratings")
    .select("rating,peak_rating,games,rated_events")
    .eq("user_id", targetId)
    .maybeSingle();
  if (!target || confirmation !== target.nickname) redirect("/developer/users?error=deletion_confirmation");
  if (target.role === "super_admin") redirect("/developer/users?error=protected_operator");

  const deletionDetails = {
    reason,
    deletedProfile: target,
    deletedRating: rating,
  };
  await writeDeveloperAudit(user.id, "user.delete.request", "user", targetId, deletionDetails);

  const { data: mediaFiles, error: mediaListError } = await admin.storage
    .from("profile-media")
    .list(targetId, { limit: 100 });
  if (!mediaListError && mediaFiles?.length) {
    const { error: mediaDeleteError } = await admin.storage
      .from("profile-media")
      .remove(mediaFiles.map((file) => `${targetId}/${file.name}`));
    if (mediaDeleteError) console.error("[super-admin-user] media cleanup failed:", mediaDeleteError.message);
  }

  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) {
    console.error("[super-admin-user] auth deletion failed:", error.message);
    await writeDeveloperAudit(user.id, "user.delete.failed", "user", targetId, {
      reason,
      error: error.message,
    });
    redirect("/developer/users?error=user_deletion_failed");
  }
  await writeDeveloperAudit(user.id, "user.delete", "user", targetId, deletionDetails);
  revalidatePath("/developer/users");
  revalidatePath("/developer/audit");
  revalidatePath("/rank");
  revalidatePath("/battle");
  redirect("/developer/users?updated=deleted");
}

export async function adjustDeveloperRating(formData: FormData) {
  const { supabase, admin, user } = await requireDeveloper();
  const targetId = String(formData.get("user_id") ?? "");
  const rating = Math.round(Number(formData.get("rating")));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(targetId) || !Number.isFinite(rating) || rating < 100 || rating > 5000 || reason.length < 3 || reason.length > 200) {
    redirect("/developer/users?error=invalid_rating");
  }
  const { error } = await supabase.rpc("admin_adjust_rating", {
    p_target_user_id: targetId,
    p_rating: rating,
    p_reason: reason,
  });
  if (error && !isMissingSchemaError(error)) {
    console.error("[developer-rating] RPC failed:", error.message);
    redirect("/developer/users?error=rating_adjust_failed");
  }
  if (error) {
    const { data: current } = await admin.from("battle_ratings")
      .select("rating, peak_rating").eq("user_id", targetId).maybeSingle();
    const oldRating = current?.rating ?? 1200;
    const { error: upsertError } = await admin.from("battle_ratings").upsert({
      user_id: targetId,
      rating,
      peak_rating: Math.max(rating, current?.peak_rating ?? 1200),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (upsertError) {
      console.error("[developer-rating] compatibility update failed:", upsertError.message);
      redirect("/developer/users?error=rating_adjust_failed");
    }
    const delta = rating - oldRating;
    let notificationWarning = false;
    if (delta !== 0) {
      const { error: notificationError } = await admin.from("notifications").insert({
        user_id: targetId,
        type: "rating",
        title: delta > 0 ? "Rating 상승" : "Rating 하락",
        body: `사유: ${reason} · Rating ${oldRating} → ${rating} (${delta > 0 ? "+" : ""}${delta})`,
      });
      notificationWarning = Boolean(notificationError);
      if (notificationError) console.error("[developer-rating] notification failed:", notificationError.message);
      const { data: latestHistory } = await admin.from("battle_rating_history").select("id")
        .eq("user_id", targetId).eq("rating", rating).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latestHistory) {
        const detailedUpdate = await admin.from("battle_rating_history")
          .update({ source: "admin_adjustment", reason })
          .eq("id", latestHistory.id);
        if (detailedUpdate.error && isMissingSchemaError(detailedUpdate.error)) {
          await admin.from("battle_rating_history").update({ source: "admin_adjustment" }).eq("id", latestHistory.id);
        }
      }
    }
    await writeDeveloperAudit(user.id, "rating.adjust", "user", targetId, { rating, reason });
    revalidatePath("/developer/users");
    revalidatePath("/rank");
    redirect(`/developer/users?updated=rating&compat=1${notificationWarning ? "&warning=notification" : ""}`);
  }
  await writeDeveloperAudit(user.id, "rating.adjust", "user", targetId, { rating, reason });
  revalidatePath("/developer/users");
  revalidatePath("/rank");
  redirect("/developer/users?updated=rating");
}

export async function saveDeveloperRatingTiers(formData: FormData) {
  const { supabase, user } = await requireDeveloper();
  let tiers: Array<{ min: number; max: number; name: string; color: string }>;
  try {
    const parsed = JSON.parse(String(formData.get("tiers") ?? "[]")) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 40) throw new Error("invalid count");
    tiers = parsed.map((item) => {
      if (!item || typeof item !== "object") throw new Error("invalid row");
      const row = item as Record<string, unknown>;
      return {
        min: Number(row.min),
        max: Number(row.max),
        name: String(row.name ?? "").trim(),
        color: String(row.color ?? "").toLowerCase(),
      };
    });
  } catch {
    redirect("/developer/rating-tiers?error=invalid");
  }
  let previousMax = -1;
  for (const tier of tiers) {
    if (!Number.isInteger(tier.min) || !Number.isInteger(tier.max)
      || tier.min !== previousMax + 1 || tier.max < tier.min || tier.max > 5000
      || tier.name.length < 2 || tier.name.length > 40
      || !/^#[0-9a-f]{6}$/.test(tier.color)) {
      redirect("/developer/rating-tiers?error=invalid");
    }
    previousMax = tier.max;
  }
  if (previousMax !== 5000) redirect("/developer/rating-tiers?error=invalid");
  const { error } = await supabase.rpc("admin_set_rating_tiers", { p_tiers: tiers });
  if (error) {
    console.error("[rating-tiers] save failed:", error.message);
    redirect("/developer/rating-tiers?error=save");
  }
  await writeDeveloperAudit(user.id, "rating.tiers.update", "system", undefined, {
    tierCount: tiers.length,
    ranges: tiers,
  });
  revalidatePath("/", "layout");
  redirect("/developer/rating-tiers?updated=1");
}

export async function deleteDeveloperRatingHistory(formData: FormData) {
  const { supabase, user } = await requireDeveloper();
  const historyId = String(formData.get("history_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(historyId) || reason.length < 5 || reason.length > 300) {
    redirect("/developer/ratings?error=invalid_deletion");
  }

  const { data, error } = await supabase.rpc("admin_delete_rating_history", {
    p_history_id: historyId,
    p_reason: reason,
  });
  if (error) {
    console.error("[developer-rating-history] delete failed:", error.message);
    if (isMissingSchemaError(error)) redirect("/developer/ratings?error=migration_required");
    if (/account creation|cannot be deleted/i.test(error.message)) {
      redirect("/developer/ratings?error=protected_event");
    }
    redirect("/developer/ratings?error=deletion_failed");
  }

  const result = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const targetUserId = typeof result.userId === "string" ? result.userId : undefined;
  await writeDeveloperAudit(user.id, "rating.history.delete", "rating_history", historyId, {
    ...result,
    reason,
  });

  revalidatePath("/developer/ratings");
  revalidatePath("/developer/users");
  revalidatePath("/dashboard");
  revalidatePath("/rating/history");
  revalidatePath("/rank");
  revalidatePath("/battle");
  revalidatePath("/profile");
  if (targetUserId && UUID.test(targetUserId)) revalidatePath(`/users/${targetUserId}`);
  redirect("/developer/ratings?deleted=1");
}

export async function updateSuperAdminAuditLog(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const auditLogId = String(formData.get("audit_log_id") ?? "");
  const action = String(formData.get("action") ?? "").trim();
  const targetType = String(formData.get("target_type") ?? "").trim();
  const targetId = String(formData.get("target_id") ?? "").trim();
  const detailsText = String(formData.get("details") ?? "{}").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(auditLogId) || action.length < 2 || action.length > 100
    || targetType.length < 1 || targetType.length > 100 || targetId.length > 200
    || reason.length < 5 || reason.length > 500) {
    redirect("/developer/audit?error=invalid_edit");
  }
  let details: Record<string, unknown>;
  try {
    const parsed = JSON.parse(detailsText || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    details = parsed as Record<string, unknown>;
  } catch {
    redirect("/developer/audit?error=invalid_json");
  }

  const { error } = await supabase.rpc("super_admin_update_audit_log", {
    p_audit_log_id: auditLogId,
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId || null,
    p_details: details,
    p_reason: reason,
  });
  if (error) {
    console.error("[super-admin-audit] update failed:", error.message);
    if (isMissingSchemaError(error)) redirect("/developer/audit?error=super_admin_migration_required");
    redirect("/developer/audit?error=edit_failed");
  }
  revalidatePath("/developer/audit");
  redirect("/developer/audit?updated=edit");
}

export async function setSuperAdminAuditArchive(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const auditLogId = String(formData.get("audit_log_id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(auditLogId) || reason.length < 5 || reason.length > 500) {
    redirect("/developer/audit?error=invalid_archive");
  }
  const { error } = await supabase.rpc("super_admin_set_audit_log_archived", {
    p_audit_log_id: auditLogId,
    p_archived: archived,
    p_reason: reason,
  });
  if (error) {
    console.error("[super-admin-audit] archive failed:", error.message);
    if (isMissingSchemaError(error)) redirect("/developer/audit?error=super_admin_migration_required");
    redirect("/developer/audit?error=archive_failed");
  }
  revalidatePath("/developer/audit");
  redirect(`/developer/audit?updated=${archived ? "archive" : "restore"}&scope=${archived ? "active" : "all"}`);
}

export async function deleteSuperAdminAuditLog(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const auditLogId = String(formData.get("audit_log_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(auditLogId) || reason.length < 5 || reason.length > 500) {
    redirect("/developer/audit?error=invalid_deletion");
  }
  const { error } = await supabase.rpc("super_admin_delete_audit_log", {
    p_audit_log_id: auditLogId,
    p_reason: reason,
  });
  if (error) {
    console.error("[super-admin-audit] deletion failed:", error.message);
    if (isMissingSchemaError(error)) redirect("/developer/audit?error=deletion_migration_required");
    redirect("/developer/audit?error=deletion_failed");
  }
  revalidatePath("/developer/audit");
  redirect("/developer/audit?updated=deleted");
}

export async function bulkSuperAdminAuditLogs(formData: FormData) {
  const { supabase } = await requireSuperAdmin();
  const ids = [...new Set(formData.getAll("audit_log_id").map(String).filter((id) => UUID.test(id)))].slice(0, 100);
  const operation = String(formData.get("operation") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!ids.length || !["archive", "restore", "delete"].includes(operation)
    || reason.length < 5 || reason.length > 500) {
    redirect("/developer/audit?error=invalid_bulk");
  }
  const { data, error } = await supabase.rpc("super_admin_bulk_audit_logs", {
    p_audit_log_ids: ids,
    p_action: operation,
    p_reason: reason,
  });
  if (error) {
    console.error("[super-admin-audit] bulk operation failed:", error.message);
    if (isMissingSchemaError(error)) redirect("/developer/audit?error=bulk_migration_required");
    redirect("/developer/audit?error=bulk_failed");
  }
  revalidatePath("/developer/audit");
  redirect(`/developer/audit?updated=bulk-${operation}&count=${Number(data) || ids.length}&scope=all`);
}

export async function sendDeveloperAnnouncement(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  const gradeLevel = String(formData.get("grade_level") ?? "");
  const targetUserId = String(formData.get("user_id") ?? "").trim();
  if (title.length < 2 || title.length > 100 || body.length < 2 || body.length > 1000
    || !["all", "grade", "user"].includes(audience)
    || (audience === "grade" && !isGradeLevel(gradeLevel))
    || (audience === "user" && !UUID.test(targetUserId))) {
    redirect("/developer/notifications?error=invalid_announcement");
  }

  const recipientIds: string[] = [];
  const pageSize = 1000;
  for (let start = 0; start < 10_000; start += pageSize) {
    let query = admin.from("profiles").select("id").order("id").range(start, start + pageSize - 1);
    if (audience === "grade") query = query.eq("grade_level", gradeLevel);
    if (audience === "user") query = query.eq("id", targetUserId);
    const { data, error } = await query;
    if (error) {
      console.error("[developer-announcement] recipients failed:", error.message);
      redirect("/developer/notifications?error=announcement_failed");
    }
    recipientIds.push(...(data ?? []).map((row) => row.id));
    if ((data ?? []).length < pageSize || audience === "user") break;
  }
  if (!recipientIds.length) redirect("/developer/notifications?error=no_recipients");

  for (let index = 0; index < recipientIds.length; index += 500) {
    const batch = recipientIds.slice(index, index + 500).map((userId) => ({
      user_id: userId,
      type: "announcement",
      title,
      body,
    }));
    const { error } = await admin.from("notifications").insert(batch);
    if (error) {
      console.error("[developer-announcement] send failed:", error.message);
      redirect("/developer/notifications?error=announcement_failed");
    }
  }

  await writeDeveloperAudit(user.id, "notification.broadcast", "notification", undefined, {
    title,
    audience,
    gradeLevel: audience === "grade" ? gradeLevel : null,
    targetUserId: audience === "user" ? targetUserId : null,
    recipientCount: recipientIds.length,
  });
  revalidatePath("/developer/notifications");
  redirect(`/developer/notifications?sent=${recipientIds.length}`);
}

export async function setDeveloperForumPin(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const postId = String(formData.get("post_id") ?? "");
  const pinned = String(formData.get("pinned") ?? "") === "true";
  if (!UUID.test(postId)) redirect("/developer/forum?error=invalid_post");
  const { data: existingPost } = await admin.from("forum_posts")
    .select("user_id,category")
    .eq("id", postId)
    .maybeSingle();
  if (!existingPost) redirect("/developer/forum?error=invalid_post");
  if (!pinned && existingPost.category === "공지") {
    const { data: author } = await admin.from("profiles")
      .select("role")
      .eq("id", existingPost.user_id)
      .maybeSingle();
    if (isDeveloperRole(author?.role)) redirect("/developer/forum?error=protected_announcement");
  }
  const { data: post, error } = await admin.from("forum_posts")
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select("title,user_id")
    .single();
  if (error || !post) {
    console.error("[developer-forum] pin failed:", error?.message);
    redirect("/developer/forum?error=moderation_failed");
  }
  await admin.from("notifications").insert({
    user_id: post.user_id,
    type: "moderation",
    title: pinned ? "포럼 게시글이 고정되었습니다" : "포럼 게시글 고정이 해제되었습니다",
    body: `운영진이 ‘${post.title}’ 게시글의 고정 상태를 변경했습니다.`,
  });
  await writeDeveloperAudit(user.id, pinned ? "forum.pin" : "forum.unpin", "forum_post", postId, {
    title: post.title,
  });
  revalidatePath("/developer/forum");
  revalidatePath("/forum");
  redirect("/developer/forum?updated=pin");
}

export async function deleteDeveloperForumPost(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const postId = String(formData.get("post_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(postId) || reason.length < 3 || reason.length > 300) {
    redirect("/developer/forum?error=invalid_moderation_reason");
  }
  const { data: post } = await admin.from("forum_posts").select("title,user_id,category").eq("id", postId).maybeSingle();
  if (!post) redirect("/developer/forum?error=invalid_post");
  const { error } = await admin.from("forum_posts").delete().eq("id", postId);
  if (error) {
    console.error("[developer-forum] delete failed:", error.message);
    redirect("/developer/forum?error=moderation_failed");
  }
  await admin.from("notifications").insert({
    user_id: post.user_id,
    type: "moderation",
    title: "포럼 게시글이 삭제되었습니다",
    body: `‘${post.title}’ 삭제 사유: ${reason}`,
  });
  await writeDeveloperAudit(user.id, "forum.delete", "forum_post", postId, {
    title: post.title,
    category: post.category,
    reason,
    ownerId: post.user_id,
  });
  revalidatePath("/developer/forum");
  revalidatePath("/forum");
  redirect("/developer/forum?updated=deleted");
}

export async function resolveDeveloperMessageReport(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "resolved");
  const requestedModerationAction = String(formData.get("moderation_action") ?? "none");
  const moderationAction = status === "dismissed" ? "none" : requestedModerationAction;
  const resolution = String(formData.get("resolution") ?? "").trim();
  const allowedActions = ["none", "warn", "restrict_1d", "restrict_7d", "restrict_30d", "restrict_permanent"];
  if (!UUID.test(reportId) || !["resolved", "dismissed"].includes(status)
    || !allowedActions.includes(moderationAction)
    || resolution.length < 3 || resolution.length > 500) {
    redirect("/developer/reports?error=invalid_resolution");
  }

  const { data: report, error: reportError } = await admin.from("message_reports")
    .select("id,reporter_id,reported_user_id,category,status,message_snapshot")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError && isMissingSchemaError(reportError)) redirect("/developer/reports?error=upgrade_required");
  if (!report) redirect("/developer/reports?error=report_not_found");

  let restrictedUntil: string | null = null;
  if (moderationAction.startsWith("restrict_")) {
    const days = moderationAction === "restrict_1d" ? 1
      : moderationAction === "restrict_7d" ? 7
        : moderationAction === "restrict_30d" ? 30
          : null;
    restrictedUntil = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
    const { error } = await admin.from("chat_restrictions").upsert({
      user_id: report.reported_user_id,
      reason: resolution,
      restricted_until: restrictedUntil,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      console.error("[developer-report] restriction failed:", error.message);
      redirect("/developer/reports?error=moderation_failed");
    }
  }

  const reviewedAt = new Date().toISOString();
  const { error: updateError } = await admin.from("message_reports").update({
    status,
    resolution,
    reviewed_by: user.id,
    reviewed_at: reviewedAt,
    updated_at: reviewedAt,
  }).eq("id", reportId);
  if (updateError) {
    console.error("[developer-report] resolution failed:", updateError.message);
    redirect("/developer/reports?error=moderation_failed");
  }

  const notifications = [{
    user_id: report.reporter_id,
    type: "moderation",
    title: status === "resolved" ? "메시지 신고 처리가 완료되었습니다" : "메시지 신고 검토가 종료되었습니다",
    body: status === "resolved" ? `운영진 처리 결과: ${resolution}` : `검토 결과: ${resolution}`,
  }];
  if (moderationAction !== "none") {
    const actionText = moderationAction === "warn" ? "경고"
      : moderationAction === "restrict_permanent" ? "채팅 영구 제한"
        : `채팅 제한 (${moderationAction.replace("restrict_", "").replace("d", "일")})`;
    notifications.push({
      user_id: report.reported_user_id,
      type: "moderation",
      title: `채팅 운영 조치: ${actionText}`,
      body: `사유: ${resolution}${restrictedUntil ? ` · ${new Date(restrictedUntil).toLocaleString("ko-KR")}까지` : ""}`,
    });
  }
  await admin.from("notifications").insert(notifications);
  await writeDeveloperAudit(user.id, "chat.report.resolve", "message_report", reportId, {
    status,
    category: report.category,
    reportedUserId: report.reported_user_id,
    moderationAction,
    restrictedUntil,
    resolution,
  });
  revalidatePath("/developer/reports");
  redirect("/developer/reports?updated=resolved");
}

export async function startDeveloperMessageReportReview(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const reportId = String(formData.get("report_id") ?? "");
  if (!UUID.test(reportId)) redirect("/developer/reports?error=report_not_found");
  const { data, error } = await admin.from("message_reports")
    .update({ status: "reviewing", updated_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "pending")
    .select("reported_user_id,category")
    .maybeSingle();
  if (error && isMissingSchemaError(error)) redirect("/developer/reports?error=upgrade_required");
  if (error || !data) redirect("/developer/reports?error=moderation_failed");
  await writeDeveloperAudit(user.id, "chat.report.review_start", "message_report", reportId, {
    reportedUserId: data.reported_user_id,
    category: data.category,
  });
  revalidatePath("/developer/reports");
  redirect("/developer/reports?updated=reviewing");
}

export async function liftDeveloperChatRestriction(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const targetUserId = String(formData.get("user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(targetUserId) || reason.length < 3 || reason.length > 300) {
    redirect("/developer/reports?error=invalid_lift");
  }
  const { error } = await admin.from("chat_restrictions").delete().eq("user_id", targetUserId);
  if (error) {
    console.error("[developer-report] restriction lift failed:", error.message);
    redirect("/developer/reports?error=moderation_failed");
  }
  await admin.from("notifications").insert({
    user_id: targetUserId,
    type: "moderation",
    title: "채팅 제한이 해제되었습니다",
    body: `운영진 확인 결과 채팅을 다시 사용할 수 있습니다. 사유: ${reason}`,
  });
  await writeDeveloperAudit(user.id, "chat.restriction.lift", "user", targetUserId, { reason });
  revalidatePath("/developer/reports");
  redirect("/developer/reports?updated=lifted");
}
