"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { findUserByEmail, setUserPlan, setUserRole } from "@/app/(main)/admin/actions";
import { PLANS, type Plan } from "@/lib/plan";
import type { AdminUserSearchResult } from "@/types";

export function UserSearch() {
  const t = useTranslations("admin.users");
  const tp = useTranslations("plan");
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<AdminUserSearchResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await findUserByEmail(email);
        setFound(result);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function handlePlanChange(plan: Plan) {
    if (!found) return;
    setError(null);
    startTransition(async () => {
      try {
        await setUserPlan(found.id, plan);
        setFound({ ...found, plan });
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function handleRoleToggle() {
    if (!found) return;
    const nextRole = found.role === "admin" ? "user" : "admin";
    setError(null);
    startTransition(async () => {
      try {
        await setUserRole(found.id, nextRole);
        setFound({ ...found, role: nextRole });
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("emailPlaceholder")}
          type="email"
        />
        <Button type="button" variant="outline" onClick={handleSearch} disabled={isPending || !email.trim()}>
          {t("searchButton")}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {found === null && <p className="text-sm text-muted-foreground">{t("notFound")}</p>}

      {found && (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{found.nickname}</p>
              <p className="text-xs text-muted-foreground">{found.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={found.role === "admin" ? "warning" : "outline"}>
                {found.role === "admin" ? t("roleAdmin") : t("roleUser")}
              </Badge>
              <Badge variant="secondary">
                {t("currentPlan")}: {tp(found.plan)}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PLANS.map((plan) => (
              <Button
                key={plan}
                type="button"
                size="sm"
                variant={found.plan === plan ? "default" : "outline"}
                disabled={isPending || found.plan === plan}
                onClick={() => handlePlanChange(plan)}
              >
                {tp(plan)}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={isPending}
              onClick={handleRoleToggle}
            >
              {found.role === "admin" ? t("removeAdmin") : t("makeAdmin")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
