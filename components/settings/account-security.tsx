"use client";

import { useActionState, useState, useTransition } from "react";
import { Download, KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePassword,
  signOutOtherSessions,
  type AccountActionState,
} from "@/app/(main)/settings/actions";

const INITIAL_STATE: AccountActionState = { status: "idle", message: "" };

export function AccountSecurity({ email }: { email: string }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, INITIAL_STATE);
  const [sessionState, setSessionState] = useState<AccountActionState>(INITIAL_STATE);
  const [sessionPending, startSessionTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground">로그인 이메일</p>
        <p className="mt-1 font-medium">{email}</p>
      </div>

      <form action={passwordAction} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4" /> 비밀번호 변경</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-password">새 비밀번호</Label>
            <Input id="account-password" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-password-confirmation">새 비밀번호 확인</Label>
            <Input id="account-password-confirmation" name="password_confirmation" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
          </div>
        </div>
        {passwordState.message && <p className={`text-sm ${passwordState.status === "success" ? "text-success" : "text-destructive"}`}>{passwordState.message}</p>}
        <Button type="submit" disabled={passwordPending} className="self-start">{passwordPending ? "변경 중..." : "비밀번호 변경"}</Button>
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div>
          <p className="font-medium">로그인 기기 관리</p>
          <p className="mt-1 text-sm text-muted-foreground">분실한 기기나 공용 PC에 남은 로그인을 현재 기기를 제외하고 종료합니다.</p>
        </div>
        {sessionState.message && <p className={`text-sm ${sessionState.status === "success" ? "text-success" : "text-destructive"}`}>{sessionState.message}</p>}
        <Button
          type="button"
          variant="outline"
          disabled={sessionPending}
          onClick={() => startSessionTransition(async () => setSessionState(await signOutOtherSessions()))}
          className="self-start gap-2"
        >
          <LogOut className="h-4 w-4" /> {sessionPending ? "로그아웃 중..." : "다른 기기에서 모두 로그아웃"}
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div>
          <p className="font-medium">내 데이터 내보내기</p>
          <p className="mt-1 text-sm text-muted-foreground">학습 기록, 레이팅, 대회 참가, 포럼 활동과 대화 기록을 포함한 내 데이터를 JSON으로 내려받습니다.</p>
        </div>
        <Button asChild variant="outline" className="self-start gap-2">
          <a href="/api/account/export" download><Download className="h-4 w-4" /> 전체 데이터 다운로드</a>
        </Button>
      </div>
    </div>
  );
}
