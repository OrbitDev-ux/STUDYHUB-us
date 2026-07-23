"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { isRateLimited } from "@/lib/rate-limit";

export type UserSearchResult = { id: string; nickname: string; avatar_url: string | null; grade_level: string | null; rating: number };
export type ThreadSummary = { id: string; opponent: UserSearchResult; lastMessage: string; updatedAt: string; unread: number };
export type ChatMessage = { id: string; senderId: string; content: string; createdAt: string; readAt: string | null };
export type ChatRestriction = { reason: string; restrictedUntil: string | null };
export type ChatState = { threadId: string; opponent: UserSearchResult; messages: ChatMessage[]; restriction: ChatRestriction | null };
export type MessageReportCategory = "spam" | "harassment" | "inappropriate" | "personal_info" | "threat" | "other";
type ThreadSummaryRow = {
  thread_id: string;
  opponent_id: string;
  nickname: string;
  avatar_url: string | null;
  grade_level: string | null;
  rating: number | null;
  last_message: string;
  updated_at: string;
  unread_count: number | string | null;
};

const UUID = /^[0-9a-f-]{36}$/i;
const REPORT_CATEGORIES: MessageReportCategory[] = ["spam", "harassment", "inappropriate", "personal_info", "threat", "other"];

async function auth() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function searchMessageUsers(query: string): Promise<{ users?: UserSearchResult[]; error?: string }> {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  const value = query.trim(); if (value.length < 1 || value.length > 50) return { users: [] };
  const { data, error } = await supabase.rpc("search_message_users", { p_query: value, p_limit: 10 });
  return error ? { error: error.message } : { users: data ?? [] };
}

export async function startDirectThread(otherUserId: string) {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  const { data, error } = await supabase.rpc("get_or_create_direct_thread", { p_other_user: otherUserId });
  return error ? { error: error.message } : { threadId: data as string };
}

export async function listDirectThreads(): Promise<ThreadSummary[]> {
  const { supabase, user } = await auth(); if (!user) return [];
  const summaryResult = await supabase.rpc("get_direct_thread_summaries");
  if (!summaryResult.error) {
    return ((summaryResult.data ?? []) as ThreadSummaryRow[]).map((row) => ({
      id: row.thread_id,
      opponent: {
        id: row.opponent_id,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        grade_level: row.grade_level,
        rating: row.rating ?? 1200,
      },
      lastMessage: row.last_message,
      updatedAt: row.updated_at,
      unread: Number(row.unread_count ?? 0),
    }));
  }
  if (!isMissingSchemaError(summaryResult.error)) {
    console.error("[messages] thread summaries failed:", summaryResult.error.message);
  }
  const { data: threads } = await supabase.from("direct_threads").select("*").order("updated_at", { ascending: false });
  if (!threads?.length) return [];
  const opponentIds = threads.map((thread) => thread.user1_id === user.id ? thread.user2_id : thread.user1_id);
  const threadIds = threads.map((thread) => thread.id);
  const [{ data: profiles }, { data: ratings }, { data: messages }] = await Promise.all([
    createAdminClient().from("profiles").select("id, nickname, avatar_url, grade_level").in("id", opponentIds),
    createAdminClient().from("battle_ratings").select("user_id, rating").in("user_id", opponentIds),
    supabase.from("direct_messages").select("thread_id, sender_id, content, read_at, created_at").in("thread_id", threadIds).order("created_at", { ascending: false }),
  ]);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const ratingMap = new Map((ratings ?? []).map((rating) => [rating.user_id, rating.rating]));
  return threads.flatMap((thread) => {
    const opponentId = thread.user1_id === user.id ? thread.user2_id : thread.user1_id;
    const opponent = profileMap.get(opponentId); if (!opponent) return [];
    const threadMessages = (messages ?? []).filter((message) => message.thread_id === thread.id);
    return [{ id: thread.id, opponent: { ...opponent, rating: ratingMap.get(opponent.id) ?? 1200 }, lastMessage: threadMessages[0]?.content ?? "대화를 시작해보세요.", updatedAt: thread.updated_at, unread: threadMessages.filter((message) => message.sender_id !== user.id && !message.read_at).length }];
  });
}

export async function listBlockedMessageUsers(): Promise<UserSearchResult[]> {
  const { supabase, user } = await auth(); if (!user) return [];
  const { data: blocks } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id);
  const ids = (blocks ?? []).map((block) => block.blocked_id); if (!ids.length) return [];
  const admin = createAdminClient();
  const [{ data }, { data: ratings }] = await Promise.all([
    admin.from("profiles").select("id, nickname, avatar_url, grade_level").in("id", ids),
    admin.from("battle_ratings").select("user_id, rating").in("user_id", ids),
  ]);
  const ratingMap = new Map((ratings ?? []).map((rating) => [rating.user_id, rating.rating]));
  return (data ?? []).map((profile) => ({ ...profile, rating: ratingMap.get(profile.id) ?? 1200 }));
}

export async function getDirectChat(threadId: string): Promise<{ chat?: ChatState; error?: string }> {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  if (!UUID.test(threadId)) return { error: "대화를 찾을 수 없습니다." };
  const { data: thread } = await supabase.from("direct_threads").select("*").eq("id", threadId).single();
  if (!thread || ![thread.user1_id, thread.user2_id].includes(user.id)) return { error: "대화를 찾을 수 없습니다." };
  const opponentId = thread.user1_id === user.id ? thread.user2_id : thread.user1_id;
  const admin = createAdminClient();
  const [{ data: messages }, { data: opponent }, { data: opponentRating }, restrictionResult] = await Promise.all([
    supabase.from("direct_messages").select("id, sender_id, content, read_at, created_at").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(200),
    admin.from("profiles").select("id, nickname, avatar_url, grade_level").eq("id", opponentId).single(),
    admin.from("battle_ratings").select("rating").eq("user_id", opponentId).maybeSingle(),
    admin.from("chat_restrictions").select("reason,restricted_until").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!opponent) return { error: "상대방 정보를 찾을 수 없습니다." };
  await supabase.rpc("mark_direct_thread_read", { p_thread_id: threadId });
  const restriction = !restrictionResult.error && restrictionResult.data
    && (!restrictionResult.data.restricted_until || new Date(restrictionResult.data.restricted_until).getTime() > Date.now())
    ? { reason: restrictionResult.data.reason, restrictedUntil: restrictionResult.data.restricted_until }
    : null;
  return { chat: { threadId, opponent: { ...opponent, rating: opponentRating?.rating ?? 1200 }, messages: [...(messages ?? [])].reverse().map((message) => ({ id: message.id, senderId: message.sender_id, content: message.content, createdAt: message.created_at, readAt: message.read_at })), restriction } };
}

export async function sendDirectMessage(threadId: string, content: string) {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  const value = content.trim();
  if (!UUID.test(threadId) || !value || value.length > 2000) return { error: "메시지는 1~2000자로 입력해주세요." };
  if (await isRateLimited(`direct-message:${user.id}`, 30, 60_000)) {
    return { error: "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요." };
  }
  const { error } = await supabase.rpc("send_direct_message", { p_thread_id: threadId, p_content: value });
  if (!error) return { ok: true };
  if (/chat restricted/i.test(error.message)) return { error: "운영 정책에 따라 채팅 전송이 제한된 계정입니다." };
  if (/rate limit/i.test(error.message)) return { error: "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요." };
  if (/conversation unavailable/i.test(error.message)) return { error: "차단된 대화에서는 메시지를 보낼 수 없습니다." };
  return { error: "메시지를 보내지 못했습니다. 잠시 후 다시 시도해주세요." };
}

export async function blockMessageUser(otherUserId: string) {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  if (!UUID.test(otherUserId) || otherUserId === user.id) return { error: "사용자를 차단할 수 없습니다." };
  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: user.id, blocked_id: otherUserId },
    { onConflict: "blocker_id,blocked_id" },
  );
  return error ? { error: error.message } : { ok: true };
}

export async function unblockMessageUser(otherUserId: string) {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", otherUserId);
  return error ? { error: error.message } : { ok: true };
}

export async function reportDirectMessage(
  messageId: string,
  category: MessageReportCategory,
  reason: string,
  blockAfterReport: boolean,
): Promise<{ ok?: true; blocked?: boolean; error?: string }> {
  const { supabase, user } = await auth();
  if (!user) return { error: "로그인이 필요합니다." };
  const detail = reason.trim();
  if (!UUID.test(messageId) || !REPORT_CATEGORIES.includes(category)
    || detail.length < 3 || detail.length > 1000) {
    return { error: "신고 사유를 3~1000자로 입력해주세요." };
  }
  if (await isRateLimited(`message-report:${user.id}`, 10, 60 * 60 * 1000)) {
    return { error: "신고 접수가 너무 많습니다. 잠시 후 다시 시도해주세요." };
  }

  const { error } = await supabase.rpc("report_direct_message", {
    p_message_id: messageId,
    p_category: category,
    p_reason: detail,
  });
  if (error) {
    if (isMissingSchemaError(error)) return { error: "채팅 신고 기능을 사용하려면 최신 데이터베이스 업데이트가 필요합니다." };
    if (/cannot be reported|not found/i.test(error.message)) return { error: "신고할 수 없는 메시지입니다." };
    return { error: "신고를 접수하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  let blocked = false;
  if (blockAfterReport) {
    const { data: message } = await createAdminClient().from("direct_messages")
      .select("sender_id")
      .eq("id", messageId)
      .maybeSingle();
    if (message?.sender_id && message.sender_id !== user.id) {
      const { error: blockError } = await supabase.from("user_blocks").upsert(
        { blocker_id: user.id, blocked_id: message.sender_id },
        { onConflict: "blocker_id,blocked_id" },
      );
      blocked = !blockError;
    }
  }
  return { ok: true, blocked };
}
