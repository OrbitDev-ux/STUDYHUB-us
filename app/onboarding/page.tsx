import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveOnboardingInfo } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "프로필 설정" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md animate-slide-up">
        <CardHeader>
          <CardTitle>반가워요! 몇 가지만 알려주세요</CardTitle>
          <CardDescription>AI가 맞춤형 진단평가와 학습 계획을 준비할게요</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOnboardingInfo} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname">닉네임</Label>
              <Input id="nickname" name="nickname" defaultValue={profile?.nickname ?? ""} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="grade_level">학년</Label>
              <select
                id="grade_level"
                name="grade_level"
                required
                className="h-11 rounded-xl border border-input bg-background px-4 text-sm"
              >
                <option value="">선택해주세요</option>
                {["초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="target_study_minutes">목표 공부 시간 (분/일)</Label>
              <Input
                id="target_study_minutes"
                name="target_study_minutes"
                type="number"
                min={10}
                max={600}
                defaultValue={60}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="target_score">목표 성적</Label>
              <Input id="target_score" name="target_score" placeholder="예: 전 과목 A, 상위 10%" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exam_date">시험 날짜 (선택)</Label>
              <Input id="exam_date" name="exam_date" type="date" />
            </div>
            <Button type="submit" className="mt-2">
              다음: AI 진단평가 시작하기
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
