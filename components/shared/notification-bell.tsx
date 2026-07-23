"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, BookOpen, Medal, Sparkles, CalendarClock, TrendingUp, Megaphone, ShieldAlert, Swords } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ko, enUS, zhCN, ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { clearReadNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/(main)/notifications/actions";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DATE_FNS_LOCALES = { ko, en: enUS, zh: zhCN, ja } as const;

const TYPE_ICONS: Record<string, typeof Bell> = {
  homework: BookOpen,
  feedback: Sparkles,
  badge: Medal,
  plan: CalendarClock,
  rating: TrendingUp,
  announcement: Megaphone,
  forum_announcement: Megaphone,
  battle_challenge: Swords,
  moderation: ShieldAlert,
};

const TYPE_LINKS: Record<string, string> = {
  homework: "/homework",
  feedback: "/report",
  badge: "/rank",
  plan: "/planner",
  rating: "/battle",
  announcement: "/",
  forum_announcement: "/forum",
  battle_challenge: "/battle/play",
  moderation: "/forum",
};

export interface NotificationRow {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell({ initialNotifications, userId }: { initialNotifications: NotificationRow[]; userId: string }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const locale = useLocale();
  const dateLocale = DATE_FNS_LOCALES[locale as keyof typeof DATE_FNS_LOCALES] ?? ko;

  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const supabase = createClient();
    const refresh = async () => {
      const { data } = await supabase.from("notifications")
        .select("id, type, title, body, read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setNotifications(data as NotificationRow[]);
    };
    const channel = supabase.channel(`notifications:${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const notification = payload.new as NotificationRow;
        setNotifications((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ].slice(0, 50));
      })
      .subscribe();
    const fallback = window.setInterval(() => void refresh(), 15000);
    return () => { window.clearInterval(fallback); void supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleNotificationClick(id: string) {
    const notification = notifications.find((item) => item.id === id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    startTransition(() => markNotificationRead(id));
    const href = TYPE_LINKS[notification?.type ?? ""];
    if (href) {
      setOpen(false);
      router.push(href);
    }
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(() => markAllNotificationsRead());
  }

  function handleClearRead() {
    setNotifications((prev) => prev.filter((notification) => !notification.read));
    startTransition(() => clearReadNotifications());
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">{t("title")}</span>
            <div className="flex items-center gap-3">
              {notifications.some((notification) => notification.read) && (
                <button type="button" onClick={handleClearRead} className="text-xs text-muted-foreground hover:underline">
                  {t("clearRead")}
                </button>
              )}
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-primary hover:underline">
                  {t("markAllRead")}
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type ?? ""] ?? Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-secondary",
                      !n.read && "bg-accent/50"
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true, locale: dateLocale })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
