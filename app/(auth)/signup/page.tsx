import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { signUpWithEmail } from "../actions";
import { OAuthButtons } from "@/components/shared/oauth-buttons";
import { SubmitButton } from "@/components/shared/submit-button";

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
        <OAuthButtons />
        <div className="relative flex items-center py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="px-3 text-xs text-muted-foreground">{t("orEmailSignup")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={signUpWithEmail} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nickname">{tc("nickname")}</Label>
            <Input id="nickname" name="nickname" placeholder={t("nicknamePlaceholder")} required maxLength={20} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{tc("email")}</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{tc("password")}</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          </div>
          {params.error && <p className="text-sm text-destructive">{t("signupError")}</p>}
          <SubmitButton className="mt-2">{t("signupSubmit")}</SubmitButton>
        </form>

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
