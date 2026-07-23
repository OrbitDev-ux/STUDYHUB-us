import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleStop, Eye, PencilLine, Swords, XCircle } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { finishDeveloperContest, setDeveloperContestStatus, updateDeveloperContest } from "../../actions";
import { ContestBuilder } from "@/components/developer/contest-builder";
import { CodingContestBuilder } from "@/components/developer/coding-contest-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isMissingSchemaError } from "@/lib/developer/schema-status";

export const metadata = { title: "Developer Contests" };

const ERRORS: Record<string, string> = {
  invalid_contest: "대회 입력값을 확인해주세요.",
  invalid_questions: "선택한 문제가 현재 학년·과목 또는 공개 상태와 일치하지 않습니다.",
  draft_requires_upgrade: "초안 대회는 0021 마이그레이션 적용 후 사용할 수 있습니다.",
  contest_create_failed: "대회를 생성하지 못했습니다.",
  invalid_contest_id: "잘못된 대회 ID입니다.",
  publishing_requires_upgrade: "대회 공개 상태 관리는 0021 마이그레이션 적용이 필요합니다.",
  contest_status_failed: "대회 상태를 변경하지 못했습니다.",
  contest_not_started: "이미 시작한 대회만 즉시 종료할 수 있습니다.",
  contest_finish_failed: "대회를 종료하지 못했습니다.",
  invalid_coding_contest: "코딩 대회 입력값과 선택한 문제를 확인해주세요.",
  invalid_coding_problems: "선택한 코딩 문제가 공개 상태가 아니거나 대상 학년과 일치하지 않습니다.",
  coding_contest_migration: "코딩 대회에는 0029~0033 데이터베이스 마이그레이션이 필요합니다.",
  contest_edit_closed: "이미 시작된 대회는 일정과 기본 정보를 수정할 수 없습니다.",
  contest_edit_failed: "대회 정보를 수정하지 못했습니다.",
};

type ContestRow = {
  id: string; title: string; description: string; grade_level: string; subject_id: string;
  question_keys: unknown; starts_at: string; ends_at: string; publication_status: "draft" | "published" | "cancelled";
  is_rated: boolean; ratings_finalized_at: string | null;
  contest_mode: "quiz" | "output_judge";
  judge_problem_ids: string[];
};

export default async function DeveloperContestsPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; updated?: string; compat?: string }> }) {
  const { admin } = await requireDeveloper();
  const params = await searchParams;
  const [modernQuestions, modernContests, judgeProblemsResult] = await Promise.all([
    admin.from("questions").select("id, grade_level, subject_id, unit_name, difficulty, content")
      .eq("status", "published").not("grade_level", "is", null).order("created_at", { ascending: false }).limit(300),
    admin.from("contests").select("id, title, description, grade_level, subject_id, question_keys, starts_at, ends_at, publication_status, is_rated, ratings_finalized_at, contest_mode, judge_problem_ids")
      .order("starts_at", { ascending: false }).limit(100),
    admin.from("oj_problems").select("id,title,difficulty,grade_level")
      .eq("status", "published").order("created_at", { ascending: false }).limit(300),
  ]);
  let questionRows = modernQuestions.data ?? [];
  let questionSchemaReady = !modernQuestions.error;
  if (modernQuestions.error && isMissingSchemaError(modernQuestions.error)) {
    questionSchemaReady = false;
    const { data: legacy } = await admin.from("questions")
      .select("id, subject_id, difficulty, content, source, units!inner(name, grade_level)")
      .eq("source", "developer:published").order("created_at", { ascending: false }).limit(300);
    questionRows = (legacy ?? []).map((row) => {
      const unit = Array.isArray(row.units) ? row.units[0] : row.units;
      return { id: row.id, subject_id: row.subject_id, difficulty: row.difficulty, content: row.content, grade_level: unit?.grade_level ?? null, unit_name: unit?.name ?? "직접 출제" };
    });
  }
  let contestSchemaReady = !modernContests.error;
  let codingContestSchemaReady = !modernContests.error && !judgeProblemsResult.error;
  let contests: ContestRow[];
  if (!modernContests.error) {
    contests = (modernContests.data ?? []) as ContestRow[];
  } else if (isMissingSchemaError(modernContests.error)) {
    const baseModern = await admin.from("contests")
      .select("id, title, description, grade_level, subject_id, question_keys, starts_at, ends_at, publication_status, is_rated, ratings_finalized_at")
      .order("starts_at", { ascending: false }).limit(100);
    if (!baseModern.error) {
      contests = (baseModern.data ?? []).map((contest) => ({
        ...contest,
        contest_mode: "quiz" as const,
        judge_problem_ids: [],
      }));
    } else {
      contestSchemaReady = false;
      const { data: legacy } = await admin.from("contests")
      .select("id, title, description, grade_level, subject_id, question_keys, starts_at, ends_at, is_rated, ratings_finalized_at")
      .order("starts_at", { ascending: false }).limit(100);
      contests = (legacy ?? []).map((contest) => ({
        ...contest,
        publication_status: "published" as const,
        contest_mode: "quiz" as const,
        judge_problem_ids: [],
      }));
    }
    codingContestSchemaReady = false;
  } else {
    contests = [];
    codingContestSchemaReady = false;
  }
  const contestIds = contests.map((contest) => contest.id);
  const registrationResult = contestIds.length
    ? await admin.from("contest_entries").select("contest_id,participation_mode").in("contest_id", contestIds)
    : { data: [], error: null };
  const registrationRows = registrationResult.data;
  const registrationSchemaReady = !registrationResult.error;
  const registrationCounts = new Map<string, { total: number; rated: number; unrated: number }>();
  for (const entry of registrationRows ?? []) {
    const current = registrationCounts.get(entry.contest_id) ?? { total: 0, rated: 0, unrated: 0 };
    current.total += 1;
    if (entry.participation_mode === "unrated") current.unrated += 1;
    else current.rated += 1;
    registrationCounts.set(entry.contest_id, current);
  }
  const now = Date.now();
  return <div className="flex flex-col gap-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Swords className="h-6 w-6 text-emerald-400" />Contest Control</h1><p className="mt-1 text-sm text-zinc-400">문제를 직접 선택하거나 자동 구성하여 대회를 개설합니다.</p></div>
    {params.error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{ERRORS[params.error] ?? "관리 작업을 완료하지 못했습니다."}</p>}
    {(params.created || params.updated) && <p className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">{params.created ? "대회가 생성되었습니다." : params.updated === "finished" ? "대회가 종료되고 정산을 요청했습니다." : "대회 상태가 변경되었습니다."}{params.compat && " 현재 DB가 이전 버전이어서 호환 모드로 처리했습니다."}</p>}
    {(!questionSchemaReady || !contestSchemaReady) && <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><strong>Contest Compatibility Mode</strong><p className="mt-1 text-xs text-amber-200/70">최신 DB 메타데이터가 없어 기존 questions·units·contests 스키마로 동작합니다. 초안·취소 상태 관리에는 `0021_developer_console.sql`, 참가자별 Register에는 `0032_contest_registration_modes.sql` 적용이 필요합니다.</p></div>}
    {!registrationSchemaReady && <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><strong>Register DB Upgrade Required</strong><p className="mt-1 text-xs text-amber-200/70">참가자별 Rated/Unrated 등록과 등록 인원 집계를 사용하려면 `0032_contest_registration_modes.sql`을 적용하세요.</p></div>}
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">새 대회 개최</CardTitle></CardHeader><CardContent><ContestBuilder questions={questionRows} publishingSupported={contestSchemaReady} /></CardContent></Card>
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="text-base">새 Output Judge 대회 개최</CardTitle></CardHeader>
      <CardContent>
        {!codingContestSchemaReady
          ? <p className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">공개된 코딩 문제를 불러올 수 없습니다. `0029_online_judge.sql`부터 `0033_dynamic_ratings_coding_contests_bulk_audit.sql`까지 적용하세요.</p>
          : <CodingContestBuilder problems={judgeProblemsResult.data ?? []} />}
      </CardContent>
    </Card>
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">대회 관리</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{contests.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">대회가 없습니다.</p>}{contests.map((contest) => {
      const start = new Date(contest.starts_at).getTime();
      const end = new Date(contest.ends_at).getTime();
      const phase = contest.publication_status === "cancelled" ? "Cancelled" : now < start ? "Scheduled" : now <= end ? "Live" : "Finished";
      const count = contest.contest_mode === "output_judge"
        ? contest.judge_problem_ids?.length ?? 0
        : Array.isArray(contest.question_keys) ? contest.question_keys.length : 0;
      const duration = Math.max(5, Math.round((end - start) / 60_000));
      const registered = registrationCounts.get(contest.id) ?? { total: 0, rated: 0, unrated: 0 };
      return <div key={contest.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex flex-wrap gap-2"><Badge variant={phase === "Live" ? "success" : phase === "Scheduled" ? "warning" : "secondary"}>{phase}</Badge><Badge variant="outline">{contest.publication_status}</Badge><Badge variant="outline">{contest.contest_mode === "output_judge" ? "OUTPUT JUDGE" : "QUIZ"}</Badge>{contest.is_rated && <Badge variant="outline">RATED AVAILABLE</Badge>}{contest.ratings_finalized_at && <Badge variant="secondary">SETTLED</Badge>}</div><h2 className="mt-3 font-semibold">{contest.title}</h2><p className="mt-1 text-xs text-zinc-500">{contest.grade_level} · {contest.contest_mode === "output_judge" ? "Fixed Input" : contest.subject_id} · {count}문제</p><p className="mt-1 text-xs text-zinc-500">Registered {registered.total}명 · Rated {registered.rated} · Unrated {registered.unrated}</p><p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><CalendarClock className="h-3 w-3" />{new Date(contest.starts_at).toLocaleString("ko-KR")} ~ {new Date(contest.ends_at).toLocaleString("ko-KR")}</p></div>
          <div className="flex flex-wrap gap-1"><Button asChild size="sm" variant="outline"><Link href={`/contests/${contest.id}`}><Eye className="h-3.5 w-3.5" />보기</Link></Button>{contestSchemaReady && phase === "Scheduled" && <Button asChild size="sm" variant="outline"><Link href={`/developer/contests/${contest.id}/edit`}><PencilLine className="h-3.5 w-3.5" />전체 수정</Link></Button>}{contestSchemaReady && contest.publication_status !== "published" && <form action={setDeveloperContestStatus.bind(null, contest.id, "published")}><Button size="sm" variant="outline"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />공개</Button></form>}{contestSchemaReady && contest.publication_status === "published" && now < start && <form action={setDeveloperContestStatus.bind(null, contest.id, "draft")}><Button size="sm" variant="outline">초안</Button></form>}{phase === "Live" && <form action={finishDeveloperContest.bind(null, contest.id)}><Button size="sm" variant="outline"><CircleStop className="h-3.5 w-3.5 text-amber-400" />즉시 종료</Button></form>}{contestSchemaReady && contest.publication_status !== "cancelled" && <form action={setDeveloperContestStatus.bind(null, contest.id, "cancelled")}><Button size="sm" variant="outline"><XCircle className="h-3.5 w-3.5 text-red-400" />취소</Button></form>}</div>
        </div>
        {contestSchemaReady && phase === "Scheduled" && <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-emerald-300">대회 기본 정보 수정</summary>
          <form action={updateDeveloperContest} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="contest_id" value={contest.id} />
            <label className="text-xs text-zinc-400">대회명<input name="title" defaultValue={contest.title} required minLength={2} maxLength={100} className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100" /></label>
            <label className="text-xs text-zinc-400">시작 시각<input name="starts_at" type="datetime-local" defaultValue={toDateTimeLocal(contest.starts_at)} required className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100" /></label>
            <label className="text-xs text-zinc-400">진행 시간(분)<input name="duration_minutes" type="number" min={5} max={360} defaultValue={duration} required className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100" /></label>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="is_rated" defaultChecked={contest.is_rated} />Rated 등록 허용</label>
            <label className="text-xs text-zinc-400 sm:col-span-2">설명<textarea name="description" defaultValue={contest.description} rows={3} maxLength={2000} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" /></label>
            <Button type="submit" size="sm" className="sm:col-span-2">수정 내용 저장</Button>
          </form>
        </details>}
      </div>;
    })}</CardContent></Card>
  </div>;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
