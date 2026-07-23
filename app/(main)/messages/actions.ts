"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export type UserSearchResult = { id: string; nickname: string; avatar_url: string | null; grade_level: string | null; rating: number };
export type ThreadSummary = { id: string; opponent: UserSearchResult; lastMessage: string; updatedAt: string; unread: number };
export type ChatMessage = { id: string; senderId: string; content: string; createdAt: string; readAt: string | null };
export type ChatState = { threadId: string; opponent: UserSearchResult; messages: ChatMessage[] };

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
  const { data: thread } = await supabase.from("direct_threads").select("*").eq("id", threadId).single();
  if (!thread || ![thread.user1_id, thread.user2_id].includes(user.id)) return { error: "대화를 찾을 수 없습니다." };
  const opponentId = thread.user1_id === user.id ? thread.user2_id : thread.user1_id;
  const [{ data: messages }, { data: opponent }, { data: opponentRating }] = await Promise.all([
    supabase.from("direct_messages").select("id, sender_id, content, read_at, created_at").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(200),
    createAdminClient().from("profiles").select("id, nickname, avatar_url, grade_level").eq("id", opponentId).single(),
    createAdminClient().from("battle_ratings").select("rating").eq("user_id", opponentId).maybeSingle(),
  ]);
  if (!opponent) return { error: "상대방 정보를 찾을 수 없습니다." };
  await supabase.rpc("mark_direct_thread_read", { p_thread_id: threadId });
  return { chat: { threadId, opponent: { ...opponent, rating: opponentRating?.rating ?? 1200 }, messages: [...(messages ?? [])].reverse().map((message) => ({ id: message.id, senderId: message.sender_id, content: message.content, createdAt: message.created_at, readAt: message.read_at })) } };
}

export async function sendDirectMessage(threadId: string, content: string) {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  const value = content.trim(); if (!value || value.length > 2000) return { error: "메시지는 1~2000자로 입력해주세요." };
  const { error } = await supabase.rpc("send_direct_message", { p_thread_id: threadId, p_content: value });
  return error ? { error: error.message } : { ok: true };
}

export async function blockMessageUser(otherUserId: string) {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: otherUserId });
  return error ? { error: error.message } : { ok: true };
}

export async function unblockMessageUser(otherUserId: string) {
  const { supabase, user } = await auth(); if (!user) return { error: "로그인이 필요합니다." };
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", otherUserId);
  return error ? { error: error.message } : { ok: true };
}
