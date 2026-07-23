import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Code2, ShieldCheck, Trophy, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isDeveloperRole } from "@/lib/developer/roles";

export const metadata = { title: "학습 대회" };

export default async function ContestsPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const [{ data: contests }, { data: profile }, { data: registrations }] = await Promise.all([
    supabase.from("contests").select("*").eq("publication_status", "published").order("starts_at", { ascending: false }).limit(30),
    supabase.from("profiles").select("role, grade_level").eq("id", user.id).single(),
    supabase.from("contest_entries").select("contest_id,participation_mode").eq("user_id", user.id),
  ]);
  const registrationMap = new Map((registrations ?? []).map((entry) => [entry.contest_id, entry.participation_mode as "rated" | "unrated"]));
  const now = Date.now();
  return <div className="flex flex-col gap-6"><div className="flex items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Trophy className="h-6 w-6 text-warning" /> 학습 대회</h1><p className="mt-1 text-sm text-muted-foreground">정해진 시간 안에 문제를 풀고 실시간 리더보드에서 순위를 겨뤄보세요.</p></div>{isDeveloperRole(profile?.role) && <Button asChild variant="outline" size="sm"><Link href="/developer/login"><Code2 className="h-4 w-4" />Developer Console</Link></Button>}</div>
    <div className="grid gap-4 sm:grid-cols-2">{(contests ?? []).length === 0 && <Card className="sm:col-span-2"><CardContent className="py-12 text-center text-muted-foreground">아직 개설된 대회가 없습니다.</CardContent></Card>}{(contests ?? []).map((contest) => { const phase = now < new Date(contest.starts_at).getTime() ? "예정" : now > new Date(contest.ends_at).getTime() ? "종료" : "진행 중"; const registration = registrationMap.get(contest.id); const isCoding = contest.contest_mode === "output_judge"; return <Link key={contest.id} href={`/contests/${contest.id}`}><Card className="h-full transition hover:border-primary"><CardHeader><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{contest.title}</CardTitle><Badge variant={phase === "진행 중" ? "success" : phase === "예정" ? "warning" : "secondary"}>{phase}</Badge></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{isCoding ? "OUTPUT JUDGE" : "QUIZ"}</Badge>{contest.is_rated && <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />Rated available</Badge>}{registration && <Badge variant={registration === "rated" ? "success" : "secondary"}><UserCheck className="mr-1 h-3 w-3" />Registered · {registration === "rated" ? "Rated" : "Unrated"}</Badge>}</div><CardDescription>{contest.description || (isCoding ? "고정 Input Output Judge 대회" : "10문제 스피드 대회")}</CardDescription></CardHeader><CardContent className="flex items-center justify-between text-sm"><span>{contest.grade_level} · {isCoding ? "Fixed Input" : contest.subject_id}</span><span className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-4 w-4" />{new Date(contest.starts_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></CardContent></Card></Link>; })}</div>
  </div>;
}
