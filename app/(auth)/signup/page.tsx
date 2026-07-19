import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";

export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: t("signup") };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tc("signup")}</CardTitle>
        <CardDescription>{t("signupSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignupForm error={params.error} />

        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {tc("login")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
