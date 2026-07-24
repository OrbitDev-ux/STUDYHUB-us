"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import {
  generateDiscordLinkCode,
  type DiscordLinkCodeState,
} from "@/app/(main)/settings/actions";
import { Button } from "@/components/ui/button";

const initialState: DiscordLinkCodeState = { status: "idle", message: "" };

export function DiscordLinkCodeGenerator() {
  const [state, action, pending] = useActionState(generateDiscordLinkCode, initialState);
  const [copied, setCopied] = useState(false);
  async function copyCommand() {
    if (!state.code) return;
    await navigator.clipboard.writeText(`/연동코드 코드:${state.code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <div className="mt-4 border-t border-border pt-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-primary" />일회용 코드로 연결</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">OAuth 대신 웹에서 코드를 만들고 STUDYHUBBOT 명령에 입력할 수 있습니다. 새 연결은 기존 Discord 연결을 교체합니다.</p></div>
      <form action={action}><Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{state.code ? "새 코드 만들기" : "연동 코드 생성"}</Button></form>
    </div>
    {state.status === "error" && <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{state.message}</p>}
    {state.status === "success" && state.code && <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-xs text-muted-foreground">{state.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3"><code className="rounded-lg border border-primary/30 bg-background px-4 py-2 font-mono text-xl font-bold tracking-[0.22em] text-primary">{state.code}</code><Button type="button" size="sm" onClick={copyCommand}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "복사됨" : "명령 복사"}</Button></div>
      <p className="mt-3 font-mono text-xs text-foreground">/연동코드 코드:{state.code}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{state.expiresAt ? `${new Date(state.expiresAt).toLocaleString("ko-KR")}까지 유효` : "10분 동안 유효"} · 한 번 사용하면 즉시 폐기됩니다.</p>
    </div>}
  </div>;
}
