"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resendConfirmationEmail } from "@/app/(auth)/actions";

export function ResendConfirmationButton({ email }: { email: string }) {
  const t = useTranslations("auth.checkEmail");
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  if (!email) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending || sent}
        onClick={() =>
          startTransition(async () => {
            await resendConfirmationEmail(email);
            setSent(true);
          })
        }
      >
        {sent ? t("resent") : t("resend")}
      </Button>
      {sent && <p className="text-xs text-muted-foreground">{t("resentHint")}</p>}
    </div>
  );
}
