"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDeveloper, writeDeveloperAudit } from "@/lib/developer/auth";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GRADES = ["", "초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3"];

export async function saveJudgeProblem(formData: FormData) {
  const { admin, user } = await requireDeveloper();
  const problemId = String(formData.get("problem_id") ?? "").trim();
  const isEditing = /^[0-9a-f-]{36}$/i.test(problemId);
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const title = String(formData.get("title") ?? "").trim();
  const statement = String(formData.get("statement") ?? "").trim();
  const inputDescription = String(formData.get("input_description") ?? "").trim();
  const outputDescription = String(formData.get("output_description") ?? "").trim();
  const constraintsText = String(formData.get("constraints_text") ?? "").trim();
  const gradeLevel = String(formData.get("grade_level") ?? "");
  const difficulty = Math.round(Number(formData.get("difficulty") ?? 1));
  const status = formData.get("publish_now") === "on" ? "published" : "draft";
  const fixedInput = String(formData.get("fixed_input") ?? "");
  const expectedOutput = String(formData.get("expected_output") ?? "");
  const valid = SLUG.test(slug)
    && title.length >= 2 && title.length <= 120
    && statement.length >= 10 && statement.length <= 20_000
    && inputDescription.length <= 10_000 && outputDescription.length <= 10_000 && constraintsText.length <= 10_000
    && GRADES.includes(gradeLevel) && difficulty >= 1 && difficulty <= 5
    && fixedInput.trim().length > 0 && fixedInput.length <= 50_000
    && expectedOutput.trim().length > 0 && expectedOutput.length <= 50_000;
  if (!valid) redirect("/developer/judge?error=invalid_problem");

  const values = {
    slug,
    title,
    statement,
    input_description: inputDescription,
    output_description: outputDescription,
    constraints_text: constraintsText,
    difficulty,
    grade_level: gradeLevel || null,
    status,
    updated_at: new Date().toISOString(),
  };
  const query = isEditing
    ? admin.from("oj_problems").update(values).eq("id", problemId)
    : admin.from("oj_problems").insert({ ...values, created_by: user.id });
  const { data: problem, error } = await query.select("id").single();
  if (error || !problem) {
    console.error("[developer-judge] problem create failed:", error?.message);
    redirect(`/developer/judge?error=${error?.code === "23505" ? "duplicate_slug" : "save_failed"}`);
  }
  const { error: casesError } = await admin.from("oj_test_cases").upsert({
    problem_id: problem.id,
    input: fixedInput,
    expected_output: expectedOutput,
    hidden: false,
    points: 100,
    order_index: 0,
  }, { onConflict: "problem_id,order_index" });
  if (casesError) {
    console.error("[developer-judge] cases create failed:", casesError.message);
    if (!isEditing) await admin.from("oj_problems").delete().eq("id", problem.id);
    redirect("/developer/judge?error=save_failed");
  }
  await admin.from("oj_test_cases").delete().eq("problem_id", problem.id).gt("order_index", 0);
  await writeDeveloperAudit(user.id, isEditing ? "judge.problem.update" : "judge.problem.create", "oj_problem", problem.id, {
    slug, title, status, difficulty, fixedInputLength: fixedInput.length, outputAnswerLength: expectedOutput.length,
  });
  revalidatePath("/developer/judge");
  revalidatePath("/judge");
  redirect(`/developer/judge?${isEditing ? "saved" : "created"}=1`);
}

export async function setJudgeProblemStatus(problemId: string, status: "draft" | "published" | "archived") {
  const { admin, user } = await requireDeveloper();
  if (!/^[0-9a-f-]{36}$/i.test(problemId) || !["draft", "published", "archived"].includes(status)) {
    redirect("/developer/judge?error=invalid_problem");
  }
  const { data: problem, error } = await admin.from("oj_problems")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", problemId)
    .select("slug,title")
    .single();
  if (error || !problem) {
    console.error("[developer-judge] status update failed:", error?.message);
    redirect("/developer/judge?error=save_failed");
  }
  await writeDeveloperAudit(user.id, `judge.problem.${status}`, "oj_problem", problemId, {
    slug: problem.slug, title: problem.title, status,
  });
  revalidatePath("/developer/judge");
  revalidatePath("/judge");
  revalidatePath(`/judge/${problem.slug}`);
  redirect("/developer/judge?updated=1");
}
