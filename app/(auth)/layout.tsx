import Link from "next/link";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">
        StudyHub
      </Link>
      <div className="w-full max-w-sm animate-slide-up">{children}</div>
    </main>
  );
}
