import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SubmitButton } from "@/components/shared/submit-button";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../actions";

export async function generateMetadata() {
  const t = await getTranslations("auth.resetPasswordPage");
  return { title: t("title") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.resetPasswordPage");
  const ta = await getTranslations("auth");
  const tc = await getTranslations("common");

  // 이메일의 재설정 링크(→ /api/auth/callback)를 거쳐야만 세션이 생긴다.
  // 세션 없이 이 페이지로 직접 들어오면 재설정을 진행할 수 없다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=reset_session_expired");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={updatePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
          </div>
          {params.error && (
            <p className="text-sm text-destructive">
              {params.error === "password_mismatch" ? ta("passwordMismatchError") : t("error")}
            </p>
          )}
          <SubmitButton className="mt-2">{tc("save")}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
