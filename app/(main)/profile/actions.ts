"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nickname = String(formData.get("nickname") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  if (!nickname || nickname.length > 20 || bio.length > 500) {
    throw new Error("프로필 입력값이 올바르지 않습니다.");
  }

  const { error } = await supabase.from("profiles").update({ nickname, bio }).eq("id", user.id);
  if (error) throw new Error(`프로필 저장 실패: ${error.message}`);
  revalidatePath("/profile");
}
