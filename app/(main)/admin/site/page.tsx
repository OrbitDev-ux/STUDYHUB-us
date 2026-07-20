import { createAdminClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setMaintenanceMode } from "../actions";

export default async function AdminSitePage() {
  const t = await getTranslations("admin.site");

  const admin = createAdminClient();
  const { data: appSettings } = await admin.from("app_settings").select("*").eq("id", true).single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="border-warning/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("maintenanceTitle")}
            <Badge variant={appSettings?.maintenance_mode ? "warning" : "outline"} className="text-[10px]">
              {appSettings?.maintenance_mode ? t("enabled") : t("disabled")}
            </Badge>
          </CardTitle>
          <CardDescription>{t("maintenanceDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setMaintenanceMode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="message">{t("messageLabel")}</Label>
              <Input
                id="message"
                name="message"
                defaultValue={appSettings?.maintenance_message ?? ""}
                placeholder={t("messagePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("discordNotifyHint")}</p>
            </div>
            {appSettings?.maintenance_mode ? (
              <Button type="submit" name="enabled" value="off" variant="outline" className="self-start">
                {t("disableButton")}
              </Button>
            ) : (
              <Button type="submit" name="enabled" value="on" variant="destructive" className="self-start">
                {t("enableButton")}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
