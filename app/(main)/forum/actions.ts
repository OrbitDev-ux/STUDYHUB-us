"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = ["자유", "질문", "공부팁", "대회", "공지"];

async function requireUser() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login"); return { supabase, user };
}

export async function createForumPost(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "자유");
  if (title.length < 2 || title.length > 120 || content.length < 2 || content.length > 10000 || !CATEGORIES.includes(category)) throw new Error("게시글 입력값을 확인해주세요.");
  if (category === "공지") {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") throw new Error("공지 글은 관리자만 작성할 수 있습니다.");
  }
  const { data, error } = await supabase.from("forum_posts").insert({ user_id: user.id, title, content, category }).select("id").single();
  if (error || !data) throw new Error(`게시글 저장 실패: ${error?.message ?? "unknown"}`);
  redirect(`/forum/${data.id}`);
}

export async function addForumComment(postId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const content = String(formData.get("content") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(postId) || !content || content.length > 2000) throw new Error("댓글을 확인해주세요.");
  const { error } = await supabase.from("forum_comments").insert({ post_id: postId, user_id: user.id, content });
  if (error) throw new Error(`댓글 저장 실패: ${error.message}`);
  revalidatePath(`/forum/${postId}`);
}

export async function toggleForumLike(postId: string) {
  const { supabase, user } = await requireUser();
  const { data: existing } = await supabase.from("forum_likes").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  const query = existing
    ? supabase.from("forum_likes").delete().eq("post_id", postId).eq("user_id", user.id)
    : supabase.from("forum_likes").insert({ post_id: postId, user_id: user.id });
  const { error } = await query; if (error) throw new Error(`좋아요 처리 실패: ${error.message}`);
  revalidatePath(`/forum/${postId}`); revalidatePath("/forum");
}

export async function deleteForumPost(postId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("forum_posts").delete().eq("id", postId).eq("user_id", user.id);
  if (error) throw new Error(`게시글 삭제 실패: ${error.message}`);
  redirect("/forum");
}

export async function deleteForumComment(commentId: string, postId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("forum_comments").delete().eq("id", commentId).eq("user_id", user.id);
  if (error) throw new Error(`댓글 삭제 실패: ${error.message}`);
  revalidatePath(`/forum/${postId}`);
}
