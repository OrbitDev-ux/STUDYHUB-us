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
        <p className="rounded-xl bg-secondary/60 px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
          계정 가입과 이메일 인증이 완료된 뒤 학년 정보를 설정하고 진단평가를 시작합니다.
        </p>

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
