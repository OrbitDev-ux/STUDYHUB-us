import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ensureTodayHomework } from "./actions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HomeworkList } from "@/components/homework/homework-list";
import { Sparkles } from "lucide-react";

export const metadata = { title: "오늘의 숙제" };

const CATEGORY_VARIANT: Record<string, "default" | "warning" | "secondary"> = {
  신규: "default",
  오답복습: "warning",
  단어: "secondary",
};

export default async function HomeworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const homeworkId = await ensureTodayHomework();

  const { data: homework } = await supabase
    .from("homeworks")
    .select("*, homework_items(*, questions(*))")
    .eq("id", homeworkId)
    .single();

  const items = (homework?.homework_items ?? []).sort(
    (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">오늘의 AI 숙제</h1>
        <p className="mt-1 text-sm text-muted-foreground">취약 단원 위주로 AI가 자동 생성했어요.</p>
      </div>

      <Card className="bg-accent/50">
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <CardTitle className="text-base">AI의 숙제 구성 이유</CardTitle>
            <CardDescription className="mt-1 text-foreground/80">{homework?.ai_rationale}</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        {[...new Set(items.map((i: { category: string }) => i.category))].map((c: unknown) => (
          <Badge key={String(c)} variant={CATEGORY_VARIANT[String(c)] ?? "secondary"}>
            {String(c)}
          </Badge>
        ))}
      </div>

      <HomeworkList homeworkId={homeworkId} items={items} />
    </div>
  );
}
