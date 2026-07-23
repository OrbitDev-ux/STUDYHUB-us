import { cn } from "@/lib/utils/cn";
import { RATING_TIERS, ratingTier } from "@/lib/battle/rating";

export function RatingName({ nickname, rating, className }: { nickname: string; rating: number; className?: string }) {
  const tier = ratingTier(rating);
  return <span className={cn("font-semibold", tier.textClass, className)} title={`${tier.name} (${tier.english}) · ${rating}`}>{nickname}</span>;
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
