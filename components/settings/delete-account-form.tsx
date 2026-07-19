"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/app/(main)/settings/actions";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountForm() {
  const t = useTranslations("settings.deleteAccount");
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText === CONFIRM_WORD;

  return (
    <form action={deleteAccount} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("warning")}</p>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground">{t("confirmLabel", { word: CONFIRM_WORD })}</label>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="max-w-xs"
          autoComplete="off"
        />
      </div>
      <Button type="submit" variant="destructive" disabled={!canDelete} className="self-start">
        {t("button")}
      </Button>
    </form>
  );
}
