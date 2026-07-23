import { CalendarClock, Code2, ShieldCheck, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import type { RatingPoint } from "@/lib/battle/rating-history-types";

const ICONS = {
  battle: Swords,
  coding_battle: Code2,
  contest: Trophy,
  admin: ShieldCheck,
  signup: CalendarClock,
};

export function RatingHistoryList({ history, limit = 8 }: { history: RatingPoint[]; limit?: number }) {
  return <div className="flex flex-col gap-2 border-t border-border pt-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">최근 Rating 이벤트</h3>
      <span className="text-xs text-muted-foreground">날짜 · 이벤트 · 사유</span>
    </div>
    {history.slice(-limit).reverse().map((point, index) => {
      const Icon = ICONS[point.event_type as keyof typeof ICONS] ?? CalendarClock;
      const before = point.rating_before ?? point.rating - point.rating_change;
      return <div key={`${point.created_at}-${index}`} className="grid gap-3 rounded-xl border border-border/70 bg-secondary/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background"><Icon className="h-4 w-4 text-primary" /></span>
          <div className="min-w-0">
            {point.event_href
              ? <Link href={point.event_href} className="block truncate text-sm font-semibold hover:text-primary hover:underline">{point.event_title || "Rating Update"}</Link>
              : <p className="truncate text-sm font-semibold">{point.event_title || "Rating Update"}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">{point.reason || "Rating 결과 반영"}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{new Date(point.created_at).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" })}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-muted-foreground">{before} → <strong className="text-foreground">{point.rating}</strong></p>
          <p className={`text-sm font-bold ${point.rating_change >= 0 ? "text-success" : "text-destructive"}`}>{point.rating_change >= 0 ? "+" : ""}{point.rating_change}</p>
        </div>
      </div>;
    })}
  </div>;
}
