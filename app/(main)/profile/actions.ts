"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nickname = String(formData.get("nickname") ?? "");
  const bio = String(formData.get("bio") ?? "");

  await supabase.from("profiles").update({ nickname, bio }).eq("id", user.id);
  revalidatePath("/profile");
}
