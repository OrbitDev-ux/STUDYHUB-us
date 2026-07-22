"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { togglePlanItem } from "@/app/(main)/planner/actions";
import { cn } from "@/lib/utils/cn";
import { CheckCircle2, Circle, Gift } from "lucide-react";

interface PlanItem {
  id: string;
  title: string;
  planned_minutes: number;
  priority: 1 | 2 | 3;
  type: "new" | "review";
  completed: boolean;
  subject_label: string;
}

const PRIORITY_KEY = { 1: "high", 2: "medium", 3: "low" } as const;
const PRIORITY_VARIANT = { 1: "warning", 2: "secondary", 3: "outline" } as const;

export function PlanItemList({ items }: { items: PlanItem[] }) {
  const t = useTranslations("planner");
  const tc = useTranslations("common");
  const [localItems, setLocalItems] = useState(items);
  const [, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  function toggle(item: PlanItem) {
    const next = !item.completed;
    if (pendingIds.has(item.id)) return;
    setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: next } : i)));
    setPendingIds((prev) => new Set(prev).add(item.id));
    setMessage(null);
    startTransition(() => {
      void togglePlanItem(item.id, next)
        .then((result) => {
          if (result.rewardGranted) setMessage(t("rewardEarned"));
        })
        .catch(() => {
          setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: item.completed } : i)));
          setMessage(t("toggleError"));
        })
        .finally(() => {
          setPendingIds((prev) => {
            const nextIds = new Set(prev);
            nextIds.delete(item.id);
            return nextIds;
          });
        });
    });
  }

  const completedCount = localItems.filter((item) => item.completed).length;
  const completionRate = localItems.length ? Math.round((completedCount / localItems.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">{t("progress")}</span>
          <span className="text-muted-foreground">{completedCount}/{localItems.length} · {completionRate}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionRate}%` }} />
        </div>
      </div>
      {message && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
          <Gift className="h-4 w-4" /> {message}
        </p>
      )}
      {localItems.map((item) => (
        <Card key={item.id} className={cn(item.completed && "opacity-60")}>
          <CardContent className="flex items-center gap-3 p-4">
            <button disabled={pendingIds.has(item.id)} onClick={() => toggle(item)} aria-label={t("toggleComplete")} className="disabled:opacity-50">
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("font-medium", item.completed && "line-through")}>{item.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {item.subject_label}
                </Badge>
                <Badge variant={PRIORITY_VARIANT[item.priority]} className="text-[10px]">
                  {t("priorityLabel", { level: t(`priority.${PRIORITY_KEY[item.priority]}`) })}
                </Badge>
                {item.type === "review" && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t("reviewBadge")}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{tc("minutes", { n: item.planned_minutes })}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
