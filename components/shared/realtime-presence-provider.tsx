"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PresenceContextValue = {
  onlineUserIds: Set<string>;
  connected: boolean;
};

const PresenceContext = createContext<PresenceContextValue>({ onlineUserIds: new Set(), connected: false });

export function RealtimePresenceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("studyhub:online", { config: { presence: { key: userId } } });
    const refreshAppViews = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 250);
    };
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        setOnlineIds(Object.values(state).flat().map((presence) => presence.user_id).filter(Boolean));
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_rating_history", filter: `user_id=eq.${userId}` },
        refreshAppViews,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_ratings", filter: `user_id=eq.${userId}` },
        refreshAppViews,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_challenges", filter: `challenger_id=eq.${userId}` },
        refreshAppViews,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_challenges", filter: `target_id=eq.${userId}` },
        refreshAppViews,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "forum_posts" },
        refreshAppViews,
      )
      .subscribe(async (status) => {
        const isConnected = status === "SUBSCRIBED";
        setConnected(isConnected);
        if (isConnected) {
          await channel.track({ user_id: userId, online_at: new Date().toISOString(), path: window.location.pathname });
        }
      });
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  const value = useMemo(() => ({ onlineUserIds: new Set(onlineIds), connected }), [onlineIds, connected]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function useRealtimePresence() {
  return useContext(PresenceContext);
}
