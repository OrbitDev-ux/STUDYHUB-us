// StudyHub's extended Codeforces-style ladder. Rank names stay in English and
// every Rating from 0 through 5000 belongs to exactly one tier.
export const RATING_TIERS = [
  { min: 0, max: 399, name: "Iron", english: "Iron", textClass: "text-zinc-600", bgClass: "bg-zinc-500/10", borderClass: "border-zinc-500/30", color: "#52525b", graphFill: "#e4e4e7" },
  { min: 400, max: 699, name: "Bronze", english: "Bronze", textClass: "text-amber-800", bgClass: "bg-amber-500/10", borderClass: "border-amber-500/30", color: "#92400e", graphFill: "#fcd9a5" },
  { min: 700, max: 899, name: "Silver", english: "Silver", textClass: "text-slate-500", bgClass: "bg-slate-500/10", borderClass: "border-slate-500/30", color: "#64748b", graphFill: "#cbd5e1" },
  { min: 900, max: 1099, name: "Newbie", english: "Newbie", textClass: "text-zinc-500", bgClass: "bg-zinc-500/10", borderClass: "border-zinc-500/30", color: "#71717a", graphFill: "#d4d4d8" },
  { min: 1100, max: 1199, name: "Advanced Newbie", english: "Advanced Newbie", textClass: "text-lime-700", bgClass: "bg-lime-500/10", borderClass: "border-lime-500/30", color: "#4d7c0f", graphFill: "#bef264" },
  { min: 1200, max: 1299, name: "Pupil", english: "Pupil", textClass: "text-green-600", bgClass: "bg-green-500/10", borderClass: "border-green-500/30", color: "#16a34a", graphFill: "#86efac" },
  { min: 1300, max: 1399, name: "Advanced Pupil", english: "Advanced Pupil", textClass: "text-emerald-600", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/30", color: "#059669", graphFill: "#6ee7b7" },
  { min: 1400, max: 1499, name: "Specialist", english: "Specialist", textClass: "text-cyan-600", bgClass: "bg-cyan-500/10", borderClass: "border-cyan-500/30", color: "#0891b2", graphFill: "#67e8f9" },
  { min: 1500, max: 1599, name: "Advanced Specialist", english: "Advanced Specialist", textClass: "text-teal-600", bgClass: "bg-teal-500/10", borderClass: "border-teal-500/30", color: "#0d9488", graphFill: "#5eead4" },
  { min: 1600, max: 1749, name: "Expert", english: "Expert", textClass: "text-blue-600", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/30", color: "#2563eb", graphFill: "#93c5fd" },
  { min: 1750, max: 1899, name: "Advanced Expert", english: "Advanced Expert", textClass: "text-indigo-600", bgClass: "bg-indigo-500/10", borderClass: "border-indigo-500/30", color: "#4f46e5", graphFill: "#a5b4fc" },
  { min: 1900, max: 1999, name: "Candidate Master", english: "Candidate Master", textClass: "text-violet-600", bgClass: "bg-violet-500/10", borderClass: "border-violet-500/30", color: "#7c3aed", graphFill: "#c4b5fd" },
  { min: 2000, max: 2099, name: "Advanced Candidate Master", english: "Advanced Candidate Master", textClass: "text-purple-600", bgClass: "bg-purple-500/10", borderClass: "border-purple-500/30", color: "#9333ea", graphFill: "#d8b4fe" },
  { min: 2100, max: 2199, name: "Master", english: "Master", textClass: "text-amber-600", bgClass: "bg-amber-500/10", borderClass: "border-amber-500/30", color: "#d97706", graphFill: "#fcd34d" },
  { min: 2200, max: 2299, name: "Advanced Master", english: "Advanced Master", textClass: "text-yellow-600", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/30", color: "#ca8a04", graphFill: "#fde047" },
  { min: 2300, max: 2399, name: "International Master", english: "International Master", textClass: "text-orange-600", bgClass: "bg-orange-500/10", borderClass: "border-orange-500/30", color: "#ea580c", graphFill: "#fdba74" },
  { min: 2400, max: 2599, name: "Grandmaster", english: "Grandmaster", textClass: "text-red-500", bgClass: "bg-red-500/10", borderClass: "border-red-500/30", color: "#ef4444", graphFill: "#fca5a5" },
  { min: 2600, max: 2799, name: "International Grandmaster", english: "International Grandmaster", textClass: "text-red-600", bgClass: "bg-red-600/10", borderClass: "border-red-600/30", color: "#dc2626", graphFill: "#f87171" },
  { min: 2800, max: 2999, name: "Elite Grandmaster", english: "Elite Grandmaster", textClass: "text-rose-600", bgClass: "bg-rose-500/10", borderClass: "border-rose-500/30", color: "#e11d48", graphFill: "#fb7185" },
  { min: 3000, max: 3299, name: "Legendary Grandmaster", english: "Legendary Grandmaster", textClass: "text-red-700", bgClass: "bg-red-700/10", borderClass: "border-red-700/30", color: "#b91c1c", graphFill: "#ef4444" },
  { min: 3300, max: 3599, name: "Supreme Grandmaster", english: "Supreme Grandmaster", textClass: "text-fuchsia-700", bgClass: "bg-fuchsia-500/10", borderClass: "border-fuchsia-500/30", color: "#a21caf", graphFill: "#e879f9" },
  { min: 3600, max: 3999, name: "Mythic Grandmaster", english: "Mythic Grandmaster", textClass: "text-purple-700", bgClass: "bg-purple-500/10", borderClass: "border-purple-500/30", color: "#7e22ce", graphFill: "#c084fc" },
  { min: 4000, max: 4499, name: "Titan", english: "Titan", textClass: "text-sky-700", bgClass: "bg-sky-500/10", borderClass: "border-sky-500/30", color: "#0369a1", graphFill: "#38bdf8" },
  { min: 4500, max: 4799, name: "Apex", english: "Apex", textClass: "text-pink-700", bgClass: "bg-pink-500/10", borderClass: "border-pink-500/30", color: "#be185d", graphFill: "#f472b6" },
  { min: 4800, max: 5000, name: "Ultimate Legend", english: "Ultimate Legend", textClass: "text-red-800", bgClass: "bg-red-800/10", borderClass: "border-red-800/30", color: "#991b1b", graphFill: "#dc2626" },
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

export function ratingTier(rating: number, tiers: readonly RatingTier[] = RATING_TIERS) {
  const normalized = Math.min(5000, Math.max(0, Math.round(rating)));
  return tiers.find((tier) => normalized >= tier.min && normalized <= tier.max)
    ?? tiers[tiers.length - 1]!;
}
