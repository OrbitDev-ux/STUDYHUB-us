"use client";

import { useMemo, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { RATING_TIERS, type StoredRatingTier } from "@/lib/battle/rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RatingTierEditor({
  initial,
  action,
}: {
  initial: StoredRatingTier[];
  action: (formData: FormData) => void;
}) {
  const [tiers, setTiers] = useState(initial);
  const serialized = useMemo(() => JSON.stringify(tiers), [tiers]);
  function update(index: number, patch: Partial<StoredRatingTier>) {
    setTiers((current) => current.map((tier, itemIndex) => itemIndex === index ? { ...tier, ...patch } : tier));
  }
  function add() {
    if (tiers.length >= 40) return;
    setTiers((current) => {
      const splitIndex = current.findLastIndex((tier) => tier.max > tier.min);
      if (splitIndex < 0) return current;
      const source = current[splitIndex]!;
      const splitMax = Math.floor((source.min + source.max) / 2);
      return [
        ...current.slice(0, splitIndex),
        { ...source, max: splitMax },
        { min: splitMax + 1, max: source.max, name: `Tier ${current.length + 1}`, color: source.color },
        ...current.slice(splitIndex + 1),
      ];
    });
  }
  function remove(index: number) {
    if (tiers.length <= 2) return;
    setTiers((current) => {
      const removed = current[index];
      if (!removed) return current;
      if (index === 0) {
        return current.slice(1).map((tier, itemIndex) => itemIndex === 0 ? { ...tier, min: removed.min } : tier);
      }
      return current.filter((_, itemIndex) => itemIndex !== index)
        .map((tier, itemIndex) => itemIndex === index - 1 ? { ...tier, max: removed.max } : tier);
    });
  }
  function restoreDefaults() {
    setTiers(RATING_TIERS.map(({ min, max, name, color }) => ({ min, max, name, color })));
  }
  return <form action={action} className="flex flex-col gap-4">
    <input type="hidden" name="tiers" value={serialized} />
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <div className="grid min-w-[720px] grid-cols-[36px_110px_110px_minmax(220px,1fr)_150px_44px] gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        <span /><span>Minimum</span><span>Maximum</span><span>English Rank Name</span><span>Color</span><span />
      </div>
      {tiers.map((tier, index) => <div key={index} className="grid min-w-[720px] grid-cols-[36px_110px_110px_minmax(220px,1fr)_150px_44px] items-center gap-2 border-b border-zinc-800 px-3 py-2 last:border-0">
        <GripVertical className="h-4 w-4 text-zinc-600" />
        <Input type="number" min={0} max={5000} value={tier.min} onChange={(event) => update(index, { min: Number(event.target.value) })} className={inputClass} />
        <Input type="number" min={0} max={5000} value={tier.max} onChange={(event) => update(index, { max: Number(event.target.value) })} className={inputClass} />
        <Input value={tier.name} minLength={2} maxLength={40} onChange={(event) => update(index, { name: event.target.value })} className={inputClass} />
        <div className="flex items-center gap-2"><input type="color" value={tier.color} onChange={(event) => update(index, { color: event.target.value })} className="h-9 w-12 rounded border border-zinc-700 bg-zinc-950" /><Input value={tier.color} pattern="#[0-9A-Fa-f]{6}" onChange={(event) => update(index, { color: event.target.value })} className={inputClass} /></div>
        <Button type="button" size="sm" variant="ghost" disabled={tiers.length <= 2} onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
      </div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-zinc-500">현재 {tiers.length}개 · 2~40개 · 첫 구간은 0부터, 마지막 구간은 5000까지 · 모든 범위가 빈틈없이 이어져야 합니다.</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={restoreDefaults}>기본 25개 복원</Button><Button type="button" variant="outline" onClick={add} disabled={tiers.length >= 40}><Plus className="h-4 w-4" />계급 추가</Button><Button type="submit" className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400">전체 Rating 계급 저장</Button></div>
    </div>
    <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      {tiers.map((tier) => <span key={`${tier.min}-${tier.name}`} className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ color: tier.color, borderColor: `${tier.color}66`, backgroundColor: `${tier.color}16` }}>{tier.name} · {tier.min}~{tier.max}</span>)}
    </div>
  </form>;
}

const inputClass = "border-zinc-700 bg-zinc-950";
