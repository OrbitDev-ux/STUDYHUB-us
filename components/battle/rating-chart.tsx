"use client";

import { CartesianGrid, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import { RATING_TIERS, ratingTier } from "@/lib/battle/rating";

export interface RatingPoint {
  rating: number;
  rating_change: number;
  created_at: string;
  source: string;
}

export function RatingChart({ history }: { history: RatingPoint[] }) {
  const data = history.map((point, index) => ({
    ...point,
    index,
    date: new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", year: "2-digit" }).format(new Date(point.created_at)),
  }));
  const values = data.map((point) => point.rating);
  const min = Math.max(0, Math.floor((Math.min(1200, ...values) - 150) / 100) * 100);
  const max = Math.min(5000, Math.ceil((Math.max(1400, ...values) + 150) / 100) * 100);
  const currentTier = ratingTier(values[values.length - 1] ?? 1200);

  if (data.length === 0) return <div className="flex h-72 items-center justify-center rounded-xl bg-secondary/50 text-sm text-muted-foreground">배틀을 완료하면 레이팅 변화가 여기에 기록됩니다.</div>;

  return <div className="h-[340px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 18, bottom: 16, left: 0 }}>
        {RATING_TIERS.map((tier) => <ReferenceArea key={tier.english} y1={tier.min} y2={tier.max + 1} fill={tier.graphFill} fillOpacity={0.62} ifOverflow="hidden" />)}
        <CartesianGrid stroke="currentColor" className="text-border" strokeOpacity={0.7} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} />
        <YAxis domain={[min, max]} tick={{ fontSize: 12 }} width={48} />
        <Tooltip content={<RatingTooltip />} />
        <Line type="monotone" dataKey="rating" stroke={currentTier.color} strokeWidth={3} dot={{ r: 5, fill: "#fff", stroke: currentTier.color, strokeWidth: 3 }} activeDot={{ r: 7 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}

function RatingTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RatingPoint & { date: string } }> }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return <div className="rounded-lg border border-border bg-background/95 p-3 text-xs shadow-lg"><p className="text-muted-foreground">{point.date}</p><p className="mt-1 text-base font-bold">{point.rating} <span className={point.rating_change >= 0 ? "text-success" : "text-destructive"}>{point.rating_change >= 0 ? "+" : ""}{point.rating_change}</span></p></div>;
}
