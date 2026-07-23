"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Send } from "lucide-react";
import { blockMessageUser, getDirectChat, sendDirectMessage, type ChatState } from "@/app/(main)/messages/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RatingName } from "@/components/battle/rating-identity";

export function DirectChat({ initial, myUserId }: { initial: ChatState; myUserId: string }) {
  const router = useRouter(); const [chat, setChat] = useState(initial); const [content, setContent] = useState(""); const [error, setError] = useState(""); const [pending, startTransition] = useTransition(); const bottom = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => { const result = await getDirectChat(initial.threadId); if (result.chat) setChat(result.chat); }, [initial.threadId]);
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 2000); return () => window.clearInterval(timer); }, [refresh]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [chat.messages.length]);
  function send() { if (!content.trim()) return; const value = content; setContent(""); setError(""); startTransition(async () => { const result = await sendDirectMessage(chat.threadId, value); if (result.error) { setError(result.error); setContent(value); } await refresh(); }); }
  function block() { if (!window.confirm(`${chat.opponent.nickname}님을 차단할까요? 더 이상 서로 메시지를 보낼 수 없습니다.`)) return; startTransition(async () => { const result = await blockMessageUser(chat.opponent.id); if (result.error) setError(result.error); else router.push("/messages"); }); }
  return <Card className="mx-auto max-w-3xl"><CardHeader className="flex-row items-center justify-between"><div><CardTitle><RatingName nickname={chat.opponent.nickname} rating={chat.opponent.rating} className="text-lg" /></CardTitle><p className="text-xs text-muted-foreground">{chat.opponent.grade_level} · ELO {chat.opponent.rating}</p></div><Button variant="outline" size="sm" onClick={block}><Ban className="mr-2 h-4 w-4" />차단</Button></CardHeader><CardContent className="flex flex-col gap-3"><div className="flex h-[55vh] flex-col gap-2 overflow-y-auto rounded-xl bg-secondary/40 p-4">{chat.messages.length === 0 && <p className="m-auto text-sm text-muted-foreground">첫 메시지를 보내보세요.</p>}{chat.messages.map((message) => { const mine = message.senderId === myUserId; return <div key={message.id} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-background"}`}><p className="whitespace-pre-wrap break-words">{message.content}</p><p className={`mt-1 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}{mine && ` · ${message.readAt ? "읽음" : "전송됨"}`}</p></div>; })}<div ref={bottom} /></div>{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Input value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) send(); }} maxLength={2000} placeholder="메시지를 입력하세요" /><Button onClick={send} disabled={pending || !content.trim()}><Send className="h-4 w-4" /></Button></div></CardContent></Card>;
}
