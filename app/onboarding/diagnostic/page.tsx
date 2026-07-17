import { DiagnosticFlow } from "./diagnostic-flow";

export const metadata = { title: "AI 진단평가" };

export default function DiagnosticPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <DiagnosticFlow />
    </main>
  );
}
