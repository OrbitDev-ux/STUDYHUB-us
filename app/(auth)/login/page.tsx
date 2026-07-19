import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { signInWithEmail } from "../actions";
import { OAuthButtons } from "@/components/shared/oauth-buttons";
import { SubmitButton } from "@/components/shared/submit-button";

export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: t("login") };
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string; message?: string }>;
}) {
  return <LoginForm searchParams={searchParams} />;
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string; message?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tc("login")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {params.message === "password_updated" && (
          <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">{t("passwordUpdated")}</p>
        )}
        <OAuthButtons />
        <div className="relative flex items-center py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="px-3 text-xs text-muted-foreground">{t("orEmailLogin")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={signInWithEmail} className="flex flex-col gap-4">
          <input type="hidden" name="redirect" value={params.redirect ?? "/dashboard"} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{tc("email")}</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{tc("password")}</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                {t("forgotPassword")}
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>
          {params.error && (
            <p className="text-sm text-destructive">
              {params.error === "rate_limited"
                ? t("rateLimitedError")
                : params.error === "reset_session_expired"
                  ? t("resetSessionExpiredError")
                  : t("loginError")}
            </p>
          )}
          <SubmitButton className="mt-2">{tc("login")}</SubmitButton>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {tc("signup")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
