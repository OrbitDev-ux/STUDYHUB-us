"use client";

import { createContext, useContext, useMemo } from "react";
import {
  RATING_TIERS,
  normalizeRatingTiers,
  ratingTier,
  type RatingTier,
} from "@/lib/battle/rating";

const RatingTierContext = createContext<readonly RatingTier[]>(RATING_TIERS);

export function RatingTierProvider({
  value,
  children,
}: {
  value?: unknown;
  children: React.ReactNode;
}) {
  const tiers = useMemo(() => normalizeRatingTiers(value), [value]);
  return <RatingTierContext.Provider value={tiers}>{children}</RatingTierContext.Provider>;
}

export function useRatingTiers() {
  return useContext(RatingTierContext);
}

export function useRatingTier(value: number) {
  const tiers = useRatingTiers();
  return ratingTier(value, tiers);
}
