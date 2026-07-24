// Standard Codeforces tier ladder. Only the tier ranges change here;
// the rating calculation itself remains unchanged.
export const RATING_TIERS = [
  { min: 0, max: 1199, name: "Newbie", english: "Newbie", textClass: "text-zinc-500", bgClass: "bg-zinc-500/10", borderClass: "border-zinc-500/30", color: "#71717a", graphFill: "#d4d4d8" },
  { min: 1200, max: 1399, name: "Pupil", english: "Pupil", textClass: "text-green-600", bgClass: "bg-green-500/10", borderClass: "border-green-500/30", color: "#16a34a", graphFill: "#86efac" },
  { min: 1400, max: 1599, name: "Specialist", english: "Specialist", textClass: "text-cyan-600", bgClass: "bg-cyan-500/10", borderClass: "border-cyan-500/30", color: "#0891b2", graphFill: "#67e8f9" },
  { min: 1600, max: 1899, name: "Expert", english: "Expert", textClass: "text-blue-600", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/30", color: "#2563eb", graphFill: "#93c5fd" },
  { min: 1900, max: 2099, name: "Candidate Master", english: "Candidate Master", textClass: "text-violet-600", bgClass: "bg-violet-500/10", borderClass: "border-violet-500/30", color: "#7c3aed", graphFill: "#c4b5fd" },
  { min: 2100, max: 2299, name: "Master", english: "Master", textClass: "text-amber-600", bgClass: "bg-amber-500/10", borderClass: "border-amber-500/30", color: "#d97706", graphFill: "#fcd34d" },
  { min: 2300, max: 2399, name: "International Master", english: "International Master", textClass: "text-orange-600", bgClass: "bg-orange-500/10", borderClass: "border-orange-500/30", color: "#ea580c", graphFill: "#fdba74" },
  { min: 2400, max: 2599, name: "Grandmaster", english: "Grandmaster", textClass: "text-red-500", bgClass: "bg-red-500/10", borderClass: "border-red-500/30", color: "#ef4444", graphFill: "#fca5a5" },
  { min: 2600, max: 2999, name: "International Grandmaster", english: "International Grandmaster", textClass: "text-red-600", bgClass: "bg-red-600/10", borderClass: "border-red-600/30", color: "#dc2626", graphFill: "#f87171" },
  { min: 3000, max: 5000, name: "Legendary Grandmaster", english: "Legendary Grandmaster", textClass: "text-red-700", bgClass: "bg-red-700/10", borderClass: "border-red-700/30", color: "#b91c1c", graphFill: "#ef4444" },
] as const;

export type RatingTier = {
  min: number;
  max: number;
  name: string;
  english: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  color: string;
  graphFill: string;
};

export type StoredRatingTier = Pick<RatingTier, "min" | "max" | "name" | "color">;

export function normalizeRatingTiers(value: unknown): RatingTier[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 40) return [...RATING_TIERS];
  let previousMax = -1;
  const normalized: RatingTier[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return [...RATING_TIERS];
    const raw = item as Record<string, unknown>;
    const min = Number(raw.min);
    const max = Number(raw.max);
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const color = typeof raw.color === "string" ? raw.color.toLowerCase() : "";
    if (!Number.isInteger(min) || !Number.isInteger(max) || min !== previousMax + 1
      || max < min || min < 0 || max > 5000 || name.length < 2 || name.length > 40
      || !/^#[0-9a-f]{6}$/.test(color)) return [...RATING_TIERS];
    normalized.push({
      min, max, name, english: name, color,
      textClass: "", bgClass: "", borderClass: "", graphFill: color,
    });
    previousMax = max;
  }
  return previousMax === 5000 ? normalized : [...RATING_TIERS];
}

export function battleTier(rating: number, tiers: readonly RatingTier[] = RATING_TIERS) {
  const normalized = Math.min(5000, Math.max(0, Math.round(rating)));
  return tiers.find((tier) => normalized >= tier.min && normalized <= tier.max)
    ?? tiers[tiers.length - 1]!;
}

export const ratingTier = battleTier;

export function calculateElo(rating: number, opponentRating: number, result: 0 | 0.5 | 1, k = 32) {
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  return Math.max(100, Math.round(rating + k * (result - expected)));
}
