import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ResendConfirmationButton } from "@/components/auth/resend-confirmation-button";

export async function generateMetadata() {
  const t = await getTranslations("auth.checkEmail");
  return { title: t("title") };
}

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.checkEmail");

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      {params.email && (
        <CardContent className="flex flex-col items-center">
          <ResendConfirmationButton email={params.email} />
        </CardContent>
      )}
    </Card>
  );
}
