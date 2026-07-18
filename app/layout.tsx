import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "StudyHub — 매일 공부를 관리해주는 AI 과외 선생님",
    template: "%s | StudyHub",
  },
  description:
    "AI가 실력을 진단하고, 예상 등급을 계산하고, 매일 숙제와 학습 계획을 자동으로 만들어주는 개인 학습 코치 플랫폼.",
  keywords: ["AI 학습", "AI 과외", "공부 습관", "학습 플래너", "온라인 학습", "숙제 자동생성"],
  openGraph: {
    title: "StudyHub — AI 개인 학습 코치",
    description: "AI가 매일 공부를 관리해주는 개인 과외 선생님",
    type: "website",
    locale: "ko_KR",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141416" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
