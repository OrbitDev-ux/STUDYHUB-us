import { redirect } from "next/navigation";
import { BookOpenCheck, Database, GraduationCap, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { PracticeArena } from "@/components/practice/practice-arena";
import { GRADE_LEVELS, isGradeLevel, PRACTICE_QUESTION_COUNT } from "@/lib/practice/question-bank";

export const metadata = { title: "학년별 문제은행" };

export default async function PracticePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: attempts }] = await Promise.all([
    supabase.from("profiles").select("grade_level").eq("id", user.id).single(),
    supabase.from("practice_attempts").select("is_correct, question_key").eq("user_id", user.id),
  ]);
  const initialGrade = isGradeLevel(profile?.grade_level ?? "") ? profile!.grade_level : GRADE_LEVELS[6];
  const solvedKeys = new Set((attempts ?? []).map((item) => item.question_key));
  const correct = (attempts ?? []).filter((item) => item.is_correct).length;
  const total = attempts?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">학년별 문제은행</h1>
        <p className="mt-1 text-sm text-muted-foreground">초등 1학년부터 고등 3학년까지, 과목과 학년을 골라 바로 연습하세요.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary icon={Database} label="전체 문제" value={`${PRACTICE_QUESTION_COUNT}문제`} />
        <Summary icon={GraduationCap} label="지원 학년" value="초1 ~ 고3" />
        <Summary icon={BookOpenCheck} label="서로 다른 풀이" value={`${solvedKeys.size}문제`} />
        <Summary icon={Trophy} label="누적 정답률" value={total ? `${Math.round(correct / total * 100)}%` : "—"} />
      </div>
      <PracticeArena initialGrade={initialGrade} />
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <Card><CardContent className="p-4"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></CardContent></Card>;
}
