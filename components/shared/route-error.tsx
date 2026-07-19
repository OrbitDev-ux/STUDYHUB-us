"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * App Router error.tsx 파일들이 공유하는 에러 화면. Next.js 기본 에러 화면 대신
 * 앱 톤에 맞는 안내 + 재시도 버튼을 보여준다.
 */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("routeError");

  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
