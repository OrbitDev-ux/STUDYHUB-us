"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/shared/oauth-buttons";
import { SubmitButton } from "@/components/shared/submit-button";
import { signUpWithEmail } from "@/app/(auth)/actions";

/**
 * OAuth 버튼과 이메일 가입 폼이 이용약관 동의 체크박스 하나를 공유해야 해서
 * (동의 전엔 Google/Discord 버튼도 비활성화) 클라이언트 컴포넌트로 묶는다.
 */
export function SignupForm({ error }: { error?: string }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <OAuthButtons disabled={!agreed} />
      <div className="relative flex items-center py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="px-3 text-xs text-muted-foreground">{t("orEmailSignup")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signUpWithEmail} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nickname">{tc("nickname")}</Label>
          <Input id="nickname" name="nickname" placeholder={t("nicknamePlaceholder")} required maxLength={20} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{tc("email")}</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{tc("password")}</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="agreeTerms"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            {t.rich("agreeTerms", {
              terms: (chunks) => (
                <Link href="/terms" target="_blank" className="font-medium text-primary hover:underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" target="_blank" className="font-medium text-primary hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {error && (
          <p className="text-sm text-destructive">
            {error === "rate_limit"
              ? t("signupRateLimitError")
              : error === "rate_limited"
                ? t("rateLimitedError")
                : error === "terms_required"
                  ? t("termsRequiredError")
                  : t("signupError")}
          </p>
        )}
        <SubmitButton className="mt-2" disabled={!agreed}>
          {t("signupSubmit")}
        </SubmitButton>
      </form>
    </div>
  );
}
