import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { RATING_TIERS, ratingTier } from "@/lib/battle/rating";
import { Progress } from "@/components/ui/progress";

export function RatingName({
  nickname,
  rating,
  className,
  userId,
}: {
  nickname: string;
  rating: number;
  className?: string;
  userId?: string;
}) {
  const tier = ratingTier(rating);
  const name = rating >= 3000 && nickname.length > 1
    ? <><span className="text-foreground">{nickname[0]}</span>{nickname.slice(1)}</>
    : nickname;
  const content = (
    <span
      className={cn("font-semibold", tier.textClass, className)}
      style={{ color: tier.color }}
      title={`${tier.english} · ${rating}`}
    >
      {name}
    </span>
  );
  return userId
    ? <Link href={`/users/${userId}`} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link>
    : content;
}

export function RatingBadge({ rating, compact = false }: { rating: number; compact?: boolean }) {
  const tier = ratingTier(rating);
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", tier.textClass, tier.bgClass, tier.borderClass)} title={`${tier.english} · ${tier.min}~${tier.max}`}>
    {compact ? tier.name : `${tier.name} · ${rating}`}
  </span>;
}

export function RatingScale() {
  return <div className="flex flex-wrap gap-2">
    {RATING_TIERS.map((tier) => <span key={tier.english} className={cn("rounded-md border px-2 py-1 text-[10px] font-semibold", tier.textClass, tier.bgClass, tier.borderClass)} title={tier.english}>
      {tier.name} {tier.min}+
    </span>)}
  </div>;
}

export function RatingProgress({ rating }: { rating: number }) {
  const tier = ratingTier(rating);
  const index = RATING_TIERS.findIndex((item) => item.english === tier.english);
  const next = RATING_TIERS[index + 1];
  const percent = next ? Math.min(100, Math.max(0, ((rating - tier.min) / (next.min - tier.min)) * 100)) : 100;
  return <div className="rounded-xl border border-border p-4">
    <div className="mb-2 flex items-center justify-between text-xs">
      <span className={tier.textClass}>{tier.name}</span>
      <span className="text-muted-foreground">{next ? `${next.min - rating} points to ${next.name}` : "Highest rank achieved"}</span>
    </div>
    <Progress value={percent} />
  </div>;
}
