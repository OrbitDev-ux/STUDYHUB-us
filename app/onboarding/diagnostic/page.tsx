import { getTranslations } from "next-intl/server";
import { DiagnosticFlow } from "./diagnostic-flow";

export async function generateMetadata() {
  const t = await getTranslations("diagnostic");
  return { title: t("pageTitle") };
}

export default function DiagnosticPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <DiagnosticFlow />
    </main>
  );
}
