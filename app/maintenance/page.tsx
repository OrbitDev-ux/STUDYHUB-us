import { getTranslations } from "next-intl/server";
import { Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export async function generateMetadata() {
  const t = await getTranslations("maintenance");
  return { title: t("title") };
}

export default async function MaintenancePage() {
  const t = await getTranslations("maintenance");
  const supabase = await createClient();
  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("maintenance_message")
    .eq("id", true)
    .single();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Wrench className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {appSettings?.maintenance_message || t("defaultMessage")}
      </p>
    </main>
  );
}
