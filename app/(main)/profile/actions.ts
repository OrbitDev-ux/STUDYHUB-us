"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const GRADE_LEVELS = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nickname = String(formData.get("nickname") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const grade_level = String(formData.get("grade_level") ?? "");
  const target_score = String(formData.get("target_score") ?? "").trim();
  const target_study_minutes = Number(formData.get("target_study_minutes") ?? 60);
  const exam_date = String(formData.get("exam_date") ?? "") || null;

  if (
    !nickname || nickname.length > 20 || bio.length > 500 || target_score.length > 100 ||
    !GRADE_LEVELS.includes(grade_level) || !Number.isInteger(target_study_minutes) ||
    target_study_minutes < 10 || target_study_minutes > 600 ||
    (exam_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(exam_date))
  ) {
    throw new Error("프로필 입력값이 올바르지 않습니다.");
  }

  const { error } = await supabase.from("profiles").update({
    nickname, bio, grade_level, target_score, target_study_minutes, exam_date,
  }).eq("id", user.id);
  if (error) throw new Error(`프로필 저장 실패: ${error.message}`);
  revalidatePath("/profile");
}
