"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setUserPlan, setUserRole } from "@/app/(main)/admin/actions";
import { PLANS, type Plan } from "@/lib/plan";
import type { AdminUserSummary } from "@/types";

export function RecentUsersTable({ users }: { users: AdminUserSummary[] }) {
  const t = useTranslations("admin.users");
  const tp = useTranslations("plan");
  const tc = useTranslations("common");
  const [rows, setRows] = useState(users);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePlanChange(userId: string, plan: Plan) {
    setError(null);
    setPendingId(userId);
    startTransition(async () => {
      try {
        await setUserPlan(userId, plan);
        setRows((prev) => prev.map((u) => (u.id === userId ? { ...u, plan } : u)));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleRoleToggle(user: AdminUserSummary) {
    const nextRole = user.role === "admin" ? "user" : "admin";
    setError(null);
    setPendingId(user.id);
    startTransition(async () => {
      try {
        await setUserRole(user.id, nextRole);
        setRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPendingId(null);
      }
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noUsers")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2">
        {rows.map((u) => {
          const rowPending = isPending && pendingId === u.id;
          return (
            <div
              key={u.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium">{u.nickname}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.grade_level ?? "-"} · Lv.{u.level} · {tc("streak")} {tc("daysSuffix", { days: u.streak_days })}
                  </p>
                </div>
                <Badge variant={u.role === "admin" ? "warning" : "outline"} className="text-[10px]">
                  {u.role === "admin" ? t("roleAdmin") : t("roleUser")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                  value={u.plan}
                  disabled={rowPending}
                  onChange={(e) => handlePlanChange(u.id, e.target.value as Plan)}
                >
                  {PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {tp(plan)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={rowPending}
                  onClick={() => handleRoleToggle(u)}
                >
                  {u.role === "admin" ? t("removeAdmin") : t("makeAdmin")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
