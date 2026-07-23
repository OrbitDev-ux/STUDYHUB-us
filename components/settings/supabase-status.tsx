"use client";

import { CheckCircle2, Cloud, Radio, XCircle } from "lucide-react";
import { useRealtimePresence } from "@/components/shared/realtime-presence-provider";

export function SupabaseStatus({ schemaReady }: { schemaReady: boolean }) {
  const { connected } = useRealtimePresence();
  const items = [
    { label: "Supabase Auth & API", ready: true, icon: Cloud },
    { label: "Rating / Social schema", ready: schemaReady, icon: CheckCircle2 },
    { label: "Supabase Realtime", ready: connected, icon: Radio },
  ];
  return <div className="grid gap-3 sm:grid-cols-3">
    {items.map((item) => <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
      <item.icon className="h-4 w-4 text-primary" />
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{item.label}</p><p className={`mt-0.5 flex items-center gap-1 text-[11px] ${item.ready ? "text-success" : "text-warning"}`}>{item.ready ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{item.ready ? "Connected" : "Setup required"}</p></div>
    </div>)}
  </div>;
}
