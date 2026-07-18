"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { locales, localeLabels, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    if (!locales.includes(next as Locale) || next === locale) return;
    startTransition(async () => {
      await setLocale(next as Locale);
      router.refresh();
    });
  }

  return (
    <div className="relative flex items-center">
      <Languages className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        aria-label="언어 선택 / Language"
        className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-secondary py-1.5 pl-8 pr-3 text-xs font-semibold text-foreground outline-none disabled:opacity-60"
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {localeLabels[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
