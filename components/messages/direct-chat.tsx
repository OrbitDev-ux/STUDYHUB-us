"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Ban, Flag, Loader2, Send, ShieldAlert, X } from "lucide-react";
import {
  blockMessageUser,
  getDirectChat,
  reportDirectMessage,
  sendDirectMessage,
  type ChatMessage,
  type ChatState,
  type MessageReportCategory,
} from "@/app/(main)/messages/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingName } from "@/components/battle/rating-identity";
import { createClient } from "@/lib/supabase/client";
import { useRealtimePresence } from "@/components/shared/realtime-presence-provider";

const REPORT_CATEGORIES: Array<{ value: MessageReportCategory; label: string }> = [
  { value: "spam", label: "스팸·도배" },
  { value: "harassment", label: "괴롭힘·욕설" },
  { value: "inappropriate", label: "부적절한 내용" },
  { value: "personal_info", label: "개인정보 노출" },
  { value: "threat", label: "위협·위험" },
  { value: "other", label: "기타" },
];

export function DirectChat({ initial, myUserId }: { initial: ChatState; myUserId: string }) {
  const router = useRouter();
  const [chat, setChat] = useState(initial);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [reportCategory, setReportCategory] = useState<MessageReportCategory>("harassment");
  const [reportReason, setReportReason] = useState("");
  const [blockAfterReport, setBlockAfterReport] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reportPending, startReportTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingStopTimer = useRef<number | null>(null);
  const typingDisplayTimer = useRef<number | null>(null);
  const lastTypingSentAt = useRef(0);
  const { onlineUserIds } = useRealtimePresence();
  const opponentOnline = onlineUserIds.has(chat.opponent.id);

  const refresh = useCallback(async () => {
    const result = await getDirectChat(initial.threadId);
    if (result.chat) setChat(result.chat);
  }, [initial.threadId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`dm:${initial.threadId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "direct_messages",
        filter: `thread_id=eq.${initial.threadId}`,
      }, () => void refresh())
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId !== chat.opponent.id) return;
        setOpponentTyping(Boolean(payload.typing));
        if (typingDisplayTimer.current) window.clearTimeout(typingDisplayTimer.current);
        typingDisplayTimer.current = window.setTimeout(() => setOpponentTyping(false), 2500);
      })
      .subscribe();
    channelRef.current = channel;
    const fallback = window.setInterval(() => void refresh(), 15000);
    return () => {
      channelRef.current = null;
      window.clearInterval(fallback);
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (typingDisplayTimer.current) window.clearTimeout(typingDisplayTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [chat.opponent.id, initial.threadId, refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.length, opponentTyping]);

  function broadcastTyping(value: string) {
    const now = Date.now();
    if (value.trim() && now - lastTypingSentAt.current > 800) {
      lastTypingSentAt.current = now;
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: myUserId, typing: true } });
    }
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => {
      void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: myUserId, typing: false } });
    }, 1200);
  }

  function send() {
    const value = content.trim();
    if (!value || pending || chat.restriction) return;
    const optimistic: ChatMessage = {
      id: `sending-${Date.now()}`,
      senderId: myUserId,
      content: value,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setChat((current) => ({ ...current, messages: [...current.messages, optimistic] }));
    setContent("");
    setError("");
    setNotice("");
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: myUserId, typing: false } });
    startTransition(async () => {
      const result = await sendDirectMessage(chat.threadId, value);
      if (result.error) {
        setChat((current) => ({ ...current, messages: current.messages.filter((message) => message.id !== optimistic.id) }));
        setError(result.error);
        setContent((current) => current || value);
        await refresh();
        return;
      }
      await refresh();
    });
  }

  function block() {
    if (!window.confirm(`${chat.opponent.nickname}님을 차단할까요? 더 이상 서로 메시지를 보낼 수 없습니다.`)) return;
    startTransition(async () => {
      const result = await blockMessageUser(chat.opponent.id);
      if (result.error) setError(result.error);
      else router.push("/messages");
    });
  }

  const handleReport = useCallback((message: ChatMessage) => {
    setReporting(message);
    setReportReason("");
    setError("");
  }, []);

  function submitReport() {
    if (!reporting || reportReason.trim().length < 3) return;
    setError("");
    startReportTransition(async () => {
      const result = await reportDirectMessage(
        reporting.id,
        reportCategory,
        reportReason,
        blockAfterReport,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setReporting(null);
      setReportReason("");
      setBlockAfterReport(false);
      setNotice(result.blocked
        ? "신고가 접수되었고 상대방을 차단했습니다. 운영진이 원문과 사유를 검토합니다."
        : "신고가 접수되었습니다. 운영진이 원문과 사유를 검토합니다.");
      if (result.blocked) window.setTimeout(() => router.push("/messages"), 900);
    });
  }

  return <>
    <Card className="mx-auto max-w-3xl overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link href="/messages" aria-label="대화 목록"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0"><CardTitle className="truncate"><RatingName nickname={chat.opponent.nickname} rating={chat.opponent.rating} userId={chat.opponent.id} className="text-lg" /></CardTitle><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${opponentOnline ? "bg-success" : "bg-muted-foreground/40"}`} />{opponentTyping ? "입력 중…" : opponentOnline ? "Online" : "Offline"} · {chat.opponent.grade_level || "학년 미설정"} · Rating {chat.opponent.rating}</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={block} disabled={pending}><Ban className="h-4 w-4" /><span className="hidden sm:inline">차단</span></Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-3 sm:p-5">
        {chat.restriction && <div className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>채팅 전송이 제한되었습니다.</strong><p className="mt-1 text-xs opacity-80">사유: {chat.restriction.reason}{chat.restriction.restrictedUntil ? ` · ${new Date(chat.restriction.restrictedUntil).toLocaleString("ko-KR")}까지` : " · 영구 제한"}</p></div></div>}
        {notice && <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</p>}
        <div className="flex h-[56vh] flex-col overflow-y-auto rounded-xl bg-secondary/40 p-3 sm:p-4">
          {chat.messages.length === 0 && <p className="m-auto text-center text-sm text-muted-foreground">첫 메시지를 보내보세요.<br /><span className="text-xs">불편한 메시지는 해당 말풍선의 신고 버튼으로 접수할 수 있습니다.</span></p>}
          <MessageList messages={chat.messages} myUserId={myUserId} onReport={handleReport} />
          {opponentTyping && <div className="mb-2 mr-auto rounded-2xl rounded-bl-md bg-background px-4 py-3 shadow-sm"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" /></span></div>}
          <div ref={bottom} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="rounded-xl border border-border bg-background p-2 focus-within:border-primary">
          <textarea
            value={content}
            onChange={(event) => { setContent(event.target.value); broadcastTyping(event.target.value); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            maxLength={2000}
            rows={2}
            disabled={Boolean(chat.restriction)}
            className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            placeholder={chat.restriction ? "채팅 전송이 제한되어 있습니다." : "메시지 입력 · Shift+Enter로 줄바꿈"}
          />
          <div className="flex items-center justify-between px-2"><span className={`text-[10px] ${content.length > 1800 ? "text-destructive" : "text-muted-foreground"}`}>{content.length.toLocaleString()} / 2,000</span><Button onClick={send} disabled={pending || !content.trim() || Boolean(chat.restriction)} size="sm">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}전송</Button></div>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">개인정보를 공유하지 마세요. 상대 메시지 왼쪽의 깃발 아이콘으로 신고할 수 있습니다.</p>
      </CardContent>
    </Card>

    {reporting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 id="report-title" className="flex items-center gap-2 font-bold"><Flag className="h-4 w-4 text-destructive" />메시지 신고</h2><p className="mt-1 text-xs text-muted-foreground">신고 시 메시지 원문이 운영진에게 안전하게 보존됩니다.</p></div><Button variant="ghost" size="icon" onClick={() => setReporting(null)} aria-label="닫기"><X className="h-4 w-4" /></Button></div>
        <blockquote className="mt-4 max-h-28 overflow-y-auto rounded-xl bg-secondary p-3 text-xs leading-5 text-muted-foreground">“{reporting.content}”</blockquote>
        <label className="mt-4 grid gap-1.5 text-xs font-medium">신고 유형<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value as MessageReportCategory)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">{REPORT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
        <label className="mt-3 grid gap-1.5 text-xs font-medium">상세 사유<textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} minLength={3} maxLength={1000} rows={4} className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="운영진이 상황을 이해할 수 있도록 구체적으로 작성해주세요." /></label>
        <label className="mt-3 flex items-start gap-2 rounded-xl bg-secondary/60 p-3 text-xs"><input type="checkbox" checked={blockAfterReport} onChange={(event) => setBlockAfterReport(event.target.checked)} className="mt-0.5" /><span><strong>신고 후 상대방 차단</strong><br /><span className="text-muted-foreground">더 이상 서로 메시지를 보낼 수 없게 됩니다.</span></span></label>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setReporting(null)}>취소</Button><Button variant="destructive" onClick={submitReport} disabled={reportPending || reportReason.trim().length < 3}>{reportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}신고 접수</Button></div>
      </div>
    </div>}
  </>;
}

// opponentTyping 등 부모 상태가 바뀔 때마다 메시지 최대 200개의 날짜 비교/포맷을
// 다시 계산하지 않도록 messages/myUserId/onReport가 바뀔 때만 리렌더되게 분리한다.
const MessageList = memo(function MessageList({
  messages,
  myUserId,
  onReport,
}: {
  messages: ChatMessage[];
  myUserId: string;
  onReport: (message: ChatMessage) => void;
}) {
  return <>
    {messages.map((message, index) => {
      const mine = message.senderId === myUserId;
      const previous = messages[index - 1];
      const showDate = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
      const optimistic = message.id.startsWith("sending-");
      return <div key={message.id}>
        {showDate && <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-border" /><time className="text-[10px] text-muted-foreground">{new Date(message.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</time><span className="h-px flex-1 bg-border" /></div>}
        <div className={`group mb-2 flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
          {!mine && <button type="button" onClick={() => onReport(message)} className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100" aria-label="메시지 신고" title="메시지 신고"><Flag className="h-3.5 w-3.5" /></button>}
          <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-background"}`}>
            <p className="whitespace-pre-wrap break-words leading-5">{message.content}</p>
            <p className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}{mine && <span>· {optimistic ? <span className="inline-flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />전송 중</span> : message.readAt ? "읽음" : "전송됨"}</span>}</p>
          </div>
        </div>
      </div>;
    })}
  </>;
});
