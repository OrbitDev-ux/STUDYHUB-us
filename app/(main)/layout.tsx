import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SideNav } from "@/components/shared/side-nav";
import { MobileNav } from "@/components/shared/mobile-nav";
import { TopBar } from "@/components/shared/top-bar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SideNav profile={profile} />
      <div className="flex flex-1 flex-col">
        <TopBar profile={profile} />
        <main className="flex-1 pb-24 md:pb-8">
          <div className="container max-w-5xl py-6">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
