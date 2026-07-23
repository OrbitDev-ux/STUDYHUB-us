"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { writeDeveloperAudit } from "@/lib/developer/auth";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { isDeveloperRole } from "@/lib/developer/roles";

const CATEGORIES = ["자유", "질문", "공부팁", "대회", "공지"];

async function requireUser() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login"); return { supabase, user };
}

export async function createForumPost(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  let category = String(formData.get("category") ?? "자유");
  if (title.length < 2 || title.length > 120 || content.length < 2 || content.length > 10000 || !CATEGORIES.includes(category)) throw new Error("게시글 입력값을 확인해주세요.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = isDeveloperRole(profile?.role);
  if (category === "공지" && !isAdmin) throw new Error("공지 글은 관리자만 작성할 수 있습니다.");

  if (isAdmin) {
    category = "공지";
    const { data: postId, error: rpcError } = await supabase.rpc("create_admin_forum_announcement", {
      p_title: title,
      p_content: content,
    });
    if (!rpcError && typeof postId === "string") {
      await writeDeveloperAudit(user.id, "forum.announcement.create", "forum_post", postId, {
        title,
        category,
        pinned: true,
        notificationAudience: "all",
      });
      revalidatePath("/forum");
      revalidatePath("/developer/forum");
      redirect(`/forum/${postId}`);
    }
    if (rpcError && !isMissingSchemaError(rpcError)) {
      throw new Error(`중요 공지 저장 실패: ${rpcError.message}`);
    }

    // Compatibility path until migration 0026 is applied.
    const admin = createAdminClient();
    const { data, error } = await admin.from("forum_posts")
      .insert({ user_id: user.id, title, content, category: "공지", pinned: true })
      .select("id")
      .single();
    if (error || !data) throw new Error(`중요 공지 저장 실패: ${error?.message ?? "unknown"}`);
    for (let start = 0; start < 10_000; start += 1000) {
      const { data: recipients, error: recipientError } = await admin.from("profiles")
        .select("id")
        .order("id")
        .range(start, start + 999);
      if (recipientError) throw new Error(`공지 수신자 조회 실패: ${recipientError.message}`);
      const rows = recipients ?? [];
      for (let index = 0; index < rows.length; index += 500) {
        const batch = rows.slice(index, index + 500).map((recipient) => ({
          user_id: recipient.id,
          type: "forum_announcement",
          title: `중요 공지: ${title}`,
          body: content.slice(0, 500),
        }));
        const { error: notificationError } = await admin.from("notifications").insert(batch);
        if (notificationError) throw new Error(`공지 알림 전송 실패: ${notificationError.message}`);
      }
      if (rows.length < 1000) break;
    }
    await writeDeveloperAudit(user.id, "forum.announcement.create", "forum_post", data.id, {
      title,
      category,
      pinned: true,
      notificationAudience: "all",
      compatibilityMode: true,
    });
    revalidatePath("/forum");
    revalidatePath("/developer/forum");
    redirect(`/forum/${data.id}`);
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
