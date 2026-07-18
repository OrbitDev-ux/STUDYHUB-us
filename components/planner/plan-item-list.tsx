"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { togglePlanItem } from "@/app/(main)/planner/actions";
import { cn } from "@/lib/utils/cn";
import { CheckCircle2, Circle } from "lucide-react";

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

  function toggle(item: PlanItem) {
    const next = !item.completed;
    setLocalItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: next } : i)));
    startTransition(() => {
      togglePlanItem(item.id, next);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {localItems.map((item) => (
        <Card key={item.id} className={cn(item.completed && "opacity-60")}>
          <CardContent className="flex items-center gap-3 p-4">
            <button onClick={() => toggle(item)} aria-label={t("toggleComplete")}>
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
