"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Search, ShieldCheck, UserRound } from "lucide-react";
import { searchMessageUsers, startDirectThread, unblockMessageUser, type ThreadSummary, type UserSearchResult } from "@/app/(main)/messages/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { RatingName } from "@/components/battle/rating-identity";
import { createClient } from "@/lib/supabase/client";
import { useRealtimePresence } from "@/components/shared/realtime-presence-provider";

export function MessagesHub({ threads, blocked }: { threads: ThreadSummary[]; blocked: UserSearchResult[] }) {
  const router = useRouter(); const [query, setQuery] = useState(""); const [results, setResults] = useState<UserSearchResult[]>([]); const [searched, setSearched] = useState(false); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  const { onlineUserIds } = useRealtimePresence();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("thread-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_threads" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router]);
  function search() { if (!query.trim()) return; setError(""); setSearched(true); startTransition(async () => { const result = await searchMessageUsers(query); if (result.error) setError(result.error); setResults(result.users ?? []); }); }
  function open(userId: string) { startTransition(async () => { const result = await startDirectThread(userId); if (result.threadId) router.push(`/messages/${result.threadId}`); else setError(result.error ?? "대화를 열 수 없습니다."); }); }
  return <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.8fr)_1.2fr]">
    <Card><CardHeader><CardTitle className="text-base">사용자 찾기</CardTitle></CardHeader><CardContent className="flex flex-col gap-3"><div className="flex gap-2"><Input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value) { setResults([]); setSearched(false); } }} onKeyDown={(event) => { if (event.key === "Enter") search(); }} placeholder="닉네임 검색" maxLength={50} /><Button onClick={search} disabled={pending || !query.trim()}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div>{error && <p className="text-sm text-destructive">{error}</p>}{searched && !pending && !results.length && !error && <p className="rounded-lg bg-secondary p-3 text-center text-xs text-muted-foreground">검색 결과가 없습니다.</p>}{results.map((user) => <button key={user.id} onClick={() => open(user.id)} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-secondary"><div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary"><Avatar src={user.avatar_url} size={36} className="rounded-full" fallback={<UserRound className="h-4 w-4" />} />{onlineUserIds.has(user.id) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" />}</div><div><RatingName nickname={user.nickname} rating={user.rating} className="text-sm" /><p className="text-xs text-muted-foreground">{onlineUserIds.has(user.id) ? "Online" : "Offline"} · {user.grade_level || "학년 미설정"} · {user.rating}</p></div></button>)}<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground"><p className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-primary" />안전한 대화</p><p className="mt-1 leading-5">불편한 메시지는 대화 말풍선의 깃발 버튼으로 신고하고 즉시 차단할 수 있습니다.</p></div>{blocked.length > 0 && <div className="mt-1 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">차단한 사용자</p>{blocked.map((user) => <div key={user.id} className="flex items-center justify-between py-2 text-sm"><RatingName nickname={user.nickname} rating={user.rating} /><Button variant="ghost" size="sm" onClick={() => startTransition(async () => { const result = await unblockMessageUser(user.id); if (result.error) setError(result.error); else router.refresh(); })}>차단 해제</Button></div>)}</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-primary" />최근 대화</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{threads.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">사용자를 검색해 첫 대화를 시작해보세요.</p>}{threads.map((thread) => <button key={thread.id} onClick={() => router.push(`/messages/${thread.id}`)} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:bg-secondary"><div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-full bg-accent font-semibold"><Avatar src={thread.opponent.avatar_url} size={40} className="rounded-full" fallback={thread.opponent.nickname[0]} />{onlineUserIds.has(thread.opponent.id) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-success" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><RatingName nickname={thread.opponent.nickname} rating={thread.opponent.rating} /><span className="shrink-0 text-[10px] text-muted-foreground">{new Date(thread.updatedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div><p className={`truncate text-xs ${thread.unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{thread.lastMessage}</p></div>{thread.unread > 0 && <Badge>{Math.min(thread.unread, 99)}</Badge>}</button>)}</CardContent></Card>
  </div>;
}
