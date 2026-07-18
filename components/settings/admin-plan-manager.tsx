"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { findUserByEmail, setUserPlan } from "@/app/(main)/settings/actions";
import { PLANS, type Plan } from "@/lib/plan";

type FoundUser = { id: string; nickname: string; plan: string; email: string };

export function AdminPlanManager() {
  const t = useTranslations("settings.admin");
  const tp = useTranslations("plan");
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    startTransition(async () => {
      const result = await findUserByEmail(email);
      setFound(result);
    });
  }

  function handleApply(plan: Plan) {
    if (!found) return;
    startTransition(async () => {
      await setUserPlan(found.id, plan);
      setFound({ ...found, plan });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          type="email"
        />
        <Button type="button" variant="outline" onClick={handleSearch} disabled={isPending || !email.trim()}>
          {t("searchButton")}
        </Button>
      </div>

      {found === null && <p className="text-sm text-muted-foreground">{t("notFound")}</p>}

      {found && (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{found.nickname}</p>
              <p className="text-xs text-muted-foreground">{found.email}</p>
            </div>
            <Badge variant="secondary">
              {t("currentPlan")}: {tp(found.plan)}
            </Badge>
          </div>
          <div className="flex gap-2">
            {PLANS.map((plan) => (
              <Button
                key={plan}
                type="button"
                size="sm"
                variant={found.plan === plan ? "default" : "outline"}
                disabled={isPending || found.plan === plan}
                onClick={() => handleApply(plan)}
              >
                {tp(plan)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
