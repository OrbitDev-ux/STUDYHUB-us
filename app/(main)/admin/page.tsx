import { getTranslations } from "next-intl/server";
import { getAdminStats } from "./actions";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Users, UserPlus, CalendarPlus, Activity, Clock, NotebookPen, MessageCircle, ShieldCheck } from "lucide-react";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin.overview");
  const tp = await getTranslations("plan");
  const stats = await getAdminStats();

  const planTotal = stats.plan_free + stats.plan_basic + stats.plan_pro || 1;
  const planRows: { key: "free" | "basic" | "pro"; count: number }[] = [
    { key: "free", count: stats.plan_free },
    { key: "basic", count: stats.plan_basic },
    { key: "pro", count: stats.plan_pro },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/admin/site">
          <Badge variant={stats.maintenance_mode ? "warning" : "success"}>
            {stats.maintenance_mode ? t("maintenanceOn") : t("maintenanceOff")}
          </Badge>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("totalUsers")} value={stats.total_users} icon={Users} />
        <StatCard label={t("newUsersToday")} value={stats.new_users_today} icon={UserPlus} />
        <StatCard label={t("newUsersWeek")} value={stats.new_users_week} icon={CalendarPlus} />
        <StatCard label={t("dau")} value={stats.dau} icon={Activity} />
        <StatCard label={t("studyMinutesToday")} value={stats.study_minutes_today} icon={Clock} />
        <StatCard
          label={t("homeworkToday")}
          value={`${stats.homeworks_completed_today} / ${stats.homeworks_today}`}
          icon={NotebookPen}
          hint={t("homeworkTodayHint")}
        />
        <StatCard label={t("discordLinked")} value={stats.discord_linked} icon={MessageCircle} />
        <StatCard label={t("adminCount")} value={stats.admin_count} icon={ShieldCheck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("planDistribution")}</CardTitle>
          <CardDescription>{t("planDistributionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {planRows.map((row) => (
            <div key={row.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{tp(row.key)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.count} ({Math.round((row.count / planTotal) * 100)}%)
                </span>
              </div>
              <Progress value={(row.count / planTotal) * 100} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
