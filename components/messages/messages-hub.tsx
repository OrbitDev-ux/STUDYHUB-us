"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Search, UserRound } from "lucide-react";
import { searchMessageUsers, startDirectThread, unblockMessageUser, type ThreadSummary, type UserSearchResult } from "@/app/(main)/messages/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RatingName } from "@/components/battle/rating-identity";

export function MessagesHub({ threads, blocked }: { threads: ThreadSummary[]; blocked: UserSearchResult[] }) {
  const router = useRouter(); const [query, setQuery] = useState(""); const [results, setResults] = useState<UserSearchResult[]>([]); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  function search() { setError(""); startTransition(async () => { const result = await searchMessageUsers(query); if (result.error) setError(result.error); setResults(result.users ?? []); }); }
  function open(userId: string) { startTransition(async () => { const result = await startDirectThread(userId); if (result.threadId) router.push(`/messages/${result.threadId}`); else setError(result.error ?? "대화를 열 수 없습니다."); }); }
  return <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.8fr)_1.2fr]">
    <Card><CardHeader><CardTitle className="text-base">사용자 찾기</CardTitle></CardHeader><CardContent className="flex flex-col gap-3"><div className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") search(); }} placeholder="닉네임 검색" maxLength={50} /><Button onClick={search} disabled={pending}><Search className="h-4 w-4" /></Button></div>{error && <p className="text-sm text-destructive">{error}</p>}{results.map((user) => <button key={user.id} onClick={() => open(user.id)} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-secondary"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"><UserRound className="h-4 w-4" /></div><div><RatingName nickname={user.nickname} rating={user.rating} className="text-sm" /><p className="text-xs text-muted-foreground">{user.grade_level} · {user.rating}</p></div></button>)}{blocked.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">차단한 사용자</p>{blocked.map((user) => <div key={user.id} className="flex items-center justify-between py-2 text-sm"><RatingName nickname={user.nickname} rating={user.rating} /><Button variant="ghost" size="sm" onClick={() => startTransition(async () => { await unblockMessageUser(user.id); router.refresh(); })}>차단 해제</Button></div>)}</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-primary" />최근 대화</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{threads.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">사용자를 검색해 첫 대화를 시작해보세요.</p>}{threads.map((thread) => <button key={thread.id} onClick={() => router.push(`/messages/${thread.id}`)} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-secondary"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold">{thread.opponent.nickname[0]}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><RatingName nickname={thread.opponent.nickname} rating={thread.opponent.rating} /><span className="text-[10px] text-muted-foreground">{new Date(thread.updatedAt).toLocaleDateString("ko-KR")}</span></div><p className="truncate text-xs text-muted-foreground">{thread.lastMessage}</p></div>{thread.unread > 0 && <Badge>{thread.unread}</Badge>}</button>)}</CardContent></Card>
  </div>;
}
