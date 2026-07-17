import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Link href="/" className="mb-8 text-xl font-bold tracking-tight">
        StudyHub
      </Link>
      <div className="w-full max-w-sm animate-slide-up">{children}</div>
    </main>
  );
}
