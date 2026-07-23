import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DiagnosticFlow } from "./diagnostic-flow";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getTranslations("diagnostic");
  return { title: t("pageTitle") };
}

export default async function DiagnosticPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/onboarding/diagnostic");
  const { data: profile } = await supabase.from("profiles")
    .select("grade_level,onboarding_completed")
    .eq("id", user.id)
    .single();
  if (profile?.onboarding_completed) redirect("/dashboard");
  if (!profile?.grade_level) redirect("/onboarding");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <DiagnosticFlow />
    </main>
  );
}
