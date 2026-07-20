import { requireAdmin } from "@/lib/auth/require-user";
import { getTranslations } from "next-intl/server";
import { AdminNav } from "@/components/admin/admin-nav";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("dashboardTitle") };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      {children}
    </div>
  );
}
