import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BookX } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("wrongNotes");
  return { title: t("title") };
}

export default async function WrongNotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("wrongNotes");
  const ts = await getTranslations("subjects");

  const { data: wrongAnswers } = await supabase
    .from("wrong_answers")
    .select("*, questions(content, units(name))")
    .eq("user_id", user.id)
    .order("last_wrong_at", { ascending: false });

  const active = (wrongAnswers ?? []).filter((w) => !w.mastered);
  const mastered = (wrongAnswers ?? []).filter((w) => w.mastered);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {active.length === 0 && mastered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <BookX className="h-8 w-8" />
            <p>{t("empty")}</p>
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("needsReview", { count: active.length })}</h2>
          {active.map((w) => (
            <WrongCard key={w.id} wrong={w} subjectLabel={ts(w.subject_id)} wrongCountLabel={t("wrongCount", { count: w.wrong_count })} />
          ))}
        </div>
      )}

      {mastered.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("mastered", { count: mastered.length })}</h2>
          {mastered.map((w) => (
            <WrongCard key={w.id} wrong={w} subjectLabel={ts(w.subject_id)} wrongCountLabel={t("wrongCount", { count: w.wrong_count })} mastered />
          ))}
        </div>
      )}
    </div>
  );
}

function WrongCard({
  wrong,
  subjectLabel,
  wrongCountLabel,
  mastered = false,
}: {
  wrong: { id: string; subject_id: string; wrong_count: number; questions: { content: string; units: { name: string } | null } | null };
  subjectLabel: string;
  wrongCountLabel: string;
  mastered?: boolean;
}) {
  return (
    <Link href={`/wrong-notes/${wrong.id}`}>
      <Card className={mastered ? "opacity-60" : undefined}>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="mb-1 flex gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {subjectLabel}
              </Badge>
              {wrong.questions?.units?.name && (
                <Badge variant="outline" className="text-[10px]">
                  {wrong.questions.units.name}
                </Badge>
              )}
            </div>
            <p className="truncate text-sm font-medium">{wrong.questions?.content}</p>
          </div>
          {!mastered && (
            <Badge variant="warning" className="shrink-0">
              {wrongCountLabel}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
