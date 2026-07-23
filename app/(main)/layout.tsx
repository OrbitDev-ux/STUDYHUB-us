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

  const [{ data: profile }, { data: notifications }, { data: battleRating }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("notifications")
      .select("id, type, title, body, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("battle_ratings").select("rating").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SideNav profile={profile} battleRating={battleRating?.rating ?? 1200} />
      <div className="flex flex-1 flex-col">
        <TopBar profile={profile} notifications={notifications ?? []} battleRating={battleRating?.rating ?? 1200} />
        <main className="flex-1 pb-24 md:pb-8">
          <div className="container max-w-5xl py-6">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
