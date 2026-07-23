import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ContestAdminForm } from "@/components/contests/contest-admin-form";

export const metadata = { title: "학습 대회" };

export default async function ContestsPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const [{ data: contests }, { data: profile }] = await Promise.all([
    supabase.from("contests").select("*").order("starts_at", { ascending: false }).limit(30),
    supabase.from("profiles").select("role, grade_level").eq("id", user.id).single(),
  ]);
  const now = Date.now();
  return <div className="flex flex-col gap-6"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Trophy className="h-6 w-6 text-warning" /> 학습 대회</h1><p className="mt-1 text-sm text-muted-foreground">정해진 시간 안에 문제를 풀고 실시간 리더보드에서 순위를 겨뤄보세요.</p></div>
    {profile?.role === "admin" && <Card><CardHeader><CardTitle className="text-base">관리자: 새 대회 개설</CardTitle><CardDescription>학년과 과목을 선택하면 10문제가 자동 구성됩니다.</CardDescription></CardHeader><CardContent><ContestAdminForm /></CardContent></Card>}
    <div className="grid gap-4 sm:grid-cols-2">{(contests ?? []).length === 0 && <Card className="sm:col-span-2"><CardContent className="py-12 text-center text-muted-foreground">아직 개설된 대회가 없습니다.</CardContent></Card>}{(contests ?? []).map((contest) => { const phase = now < new Date(contest.starts_at).getTime() ? "예정" : now > new Date(contest.ends_at).getTime() ? "종료" : "진행 중"; return <Link key={contest.id} href={`/contests/${contest.id}`}><Card className="h-full transition hover:border-primary"><CardHeader><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{contest.title}</CardTitle><Badge variant={phase === "진행 중" ? "success" : phase === "예정" ? "warning" : "secondary"}>{phase}</Badge></div><CardDescription>{contest.description || "10문제 스피드 대회"}</CardDescription></CardHeader><CardContent className="flex items-center justify-between text-sm"><span>{contest.grade_level} · {contest.subject_id}</span><span className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-4 w-4" />{new Date(contest.starts_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></CardContent></Card></Link>; })}</div>
  </div>;
}
