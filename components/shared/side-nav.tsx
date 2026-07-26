"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils/cn";
import { Flame } from "lucide-react";
import type { Profile } from "@/types";
import { RatingName } from "@/components/battle/rating-identity";
import { useRatingTier } from "@/components/battle/rating-tier-provider";
import { Avatar } from "@/components/ui/avatar";

export function SideNav({ profile, battleRating }: { profile: Pick<Profile, "avatar_url" | "nickname" | "streak_days"> | null; battleRating: number }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const tier = useRatingTier(battleRating);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
      <Link href="/dashboard" className="mb-8 px-2 text-lg font-bold tracking-tight">
        StudyHub
      </Link>

      {profile && (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm"
          style={{
            borderColor: `${tier.color}55`,
            background: `linear-gradient(135deg, ${tier.color}18, hsl(var(--secondary)))`,
          }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background font-semibold"
            style={{ boxShadow: `0 0 0 2px ${tier.color}, 0 0 16px ${tier.color}35` }}
          >
            <Avatar src={profile.avatar_url} size={36} fallback={profile.nickname?.[0] ?? "?"} />
          </div>
          <div className="min-w-0">
            <p className="truncate"><RatingName nickname={profile.nickname} rating={battleRating} /></p>
            <p className="truncate text-[11px] font-semibold" style={{ color: tier.color }}>
              {tier.name} · Rating {battleRating}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Flame className="h-3 w-3 text-warning" />
              {tc("streak")} {tc("daysSuffix", { days: profile.streak_days })}
            </p>
          </div>
        </div>
      )}

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
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
