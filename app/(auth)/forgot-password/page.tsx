import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/shared/submit-button";
import { requestPasswordReset } from "../actions";

export async function generateMetadata() {
  const t = await getTranslations("auth.forgotPasswordPage");
  return { title: t("title") };
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.forgotPasswordPage");
  const tc = await getTranslations("common");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={requestPasswordReset} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{tc("email")}</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          {params.error && <p className="text-sm text-destructive">{t("error")}</p>}
          <SubmitButton className="mt-2">{t("submit")}</SubmitButton>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
