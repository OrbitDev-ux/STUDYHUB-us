import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserSearch } from "@/components/admin/user-search";
import { RecentUsersTable } from "@/components/admin/recent-users-table";
import { listRecentUsers } from "../actions";

export default async function AdminUsersPage() {
  const t = await getTranslations("admin.users");
  const users = await listRecentUsers(20);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("searchTitle")}</CardTitle>
          <CardDescription>{t("searchDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <UserSearch />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recentTitle")}</CardTitle>
          <CardDescription>{t("recentDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentUsersTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
