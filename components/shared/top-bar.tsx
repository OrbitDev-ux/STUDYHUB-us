"use client";

import { useTranslations } from "next-intl";
import { Coins, Moon, Sun, LogOut, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell, type NotificationRow } from "./notification-bell";
import { signOut } from "@/app/(auth)/actions";
import { getLevelProgress } from "@/lib/gamification/level";
import type { Profile } from "@/types";
import { RatingBadge } from "@/components/battle/rating-identity";
import { MessageInboxButton } from "./message-inbox-button";
import { useRealtimePresence } from "./realtime-presence-provider";

export function TopBar({ profile, notifications, battleRating, userId, unreadMessages }: { profile: Profile | null; notifications: NotificationRow[]; battleRating: number; userId: string; unreadMessages: number }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("topbar");
  const tc = useTranslations("common");
  const progress = getLevelProgress(profile?.xp ?? 0);
  const { connected } = useRealtimePresence();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <div className="text-sm font-medium text-muted-foreground md:hidden">StudyHub</div>
      <div className="hidden text-sm text-muted-foreground md:block">
        {t.rich("greeting", {
          nickname: profile?.nickname ?? "",
          b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className={`hidden h-2 w-2 rounded-full sm:block ${connected ? "bg-success" : "bg-muted-foreground"}`} title={connected ? "Supabase Realtime connected" : "Realtime reconnecting"} />
        <div className="hidden lg:block"><RatingBadge rating={battleRating} compact /></div>
        <div
          className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          title={t("levelTooltip", {
            remaining: progress.nextLevelXp - progress.xp,
            percent: progress.progressPercent,
          })}
        >
          <Star className="h-3.5 w-3.5 text-primary" /> {tc("levelBadge", { level: progress.level })}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
          <Zap className="h-3.5 w-3.5 text-primary" /> {profile?.xp ?? 0} XP
        </div>
        <div className="hidden items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold sm:flex">
          <Coins className="h-3.5 w-3.5 text-warning" /> {profile?.coins ?? 0}
        </div>
        <NotificationBell initialNotifications={notifications} userId={userId} />
        <MessageInboxButton userId={userId} initialUnread={unreadMessages} />
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={tc("toggleTheme")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" aria-label={tc("logout")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
