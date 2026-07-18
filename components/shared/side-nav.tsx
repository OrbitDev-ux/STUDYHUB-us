"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils/cn";
import { Flame } from "lucide-react";
import type { Profile } from "@/types";

export function SideNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("common");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
      <Link href="/dashboard" className="mb-8 px-2 text-lg font-bold tracking-tight">
        StudyHub
      </Link>

      {profile && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm">
          <Flame className="h-4 w-4 text-warning" />
          <span className="font-medium">{tc("streakDays", { days: profile.streak_days })}</span>
        </div>
      )}

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
