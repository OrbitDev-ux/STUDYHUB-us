"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function MessageInboxButton({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase.from("direct_messages").select("id", { count: "exact", head: true })
      .neq("sender_id", userId).is("read_at", null);
    setUnread(count ?? 0);
  }, [userId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`inbox:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, userId]);

  return <Link href="/messages" className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label={`메시지, 읽지 않음 ${unread}개`}>
    <MessageCircle className="h-4 w-4" />
    {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[9px] font-bold text-destructive-foreground">{Math.min(unread, 99)}</span>}
  </Link>;
}
