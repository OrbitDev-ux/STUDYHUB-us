import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, Clock3, Eye, MessageSquareWarning, Search, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { liftDeveloperChatRestriction, resolveDeveloperMessageReport, startDeveloperMessageReportReview } from "../../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Developer Chat Reports" };

type ReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  thread_id: string;
  message_id: string | null;
  category: string;
  reason: string;
  message_snapshot: string;
  status: string;
  resolution: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type RestrictionRow = {
  user_id: string;
  reason: string;
  restricted_until: string | null;
  created_at: string;
};

const STATUSES = ["pending", "reviewing", "resolved", "dismissed"];
const CATEGORY_LABELS: Record<string, string> = {
  spam: "스팸·도배",
  harassment: "괴롭힘·욕설",
  inappropriate: "부적절한 내용",
  personal_info: "개인정보 노출",
  threat: "위협·위험",
  other: "기타",
};

const ERRORS: Record<string, string> = {
  invalid_resolution: "처리 결과를 3~500자로 입력하고 조치 항목을 확인해주세요.",
  invalid_lift: "제한 해제 사유를 3~300자로 입력해주세요.",
  report_not_found: "신고를 찾을 수 없습니다.",
  moderation_failed: "신고 처리 작업을 완료하지 못했습니다.",
  upgrade_required: "채팅 신고 스키마 업데이트가 필요합니다.",
};

export default async function DeveloperReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; error?: string; updated?: string }>;
}) {
  const { admin } = await requireDeveloper();
  const params = await searchParams;
  const status = STATUSES.includes(params.status ?? "") ? params.status! : "pending";
  const q = (params.q ?? "").trim().replace(/[,%()]/g, "").slice(0, 60);
  let reportsQuery = admin.from("message_reports")
    .select("id,reporter_id,reported_user_id,thread_id,message_id,category,reason,message_snapshot,status,resolution,reviewed_by,reviewed_at,created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) reportsQuery = reportsQuery.ilike("reason", `%${q}%`);

  const [reportsResult, restrictionsResult, countResults] = await Promise.all([
    reportsQuery,
    admin.from("chat_restrictions").select("user_id,reason,restricted_until,created_at")
      .or(`restricted_until.is.null,restricted_until.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false }).limit(100),
    Promise.all(STATUSES.map((item) => admin.from("message_reports").select("id", { count: "exact", head: true }).eq("status", item))),
  ]);

  if (reportsResult.error && isMissingSchemaError(reportsResult.error)) {
    return <div className="flex flex-col gap-6">
      <Header />
      <div className="flex gap-3 rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>채팅 신고 기능을 활성화하려면 DB 업데이트가 필요합니다.</strong><p className="mt-1 text-amber-200/70">Supabase에 `0024_chat_safety_and_reports.sql`을 적용하면 사용자 신고, 운영자 검토, 채팅 제한과 도배 방지가 활성화됩니다.</p></div></div>
    </div>;
  }

  const reports = (reportsResult.data ?? []) as ReportRow[];
  const restrictions = (restrictionsResult.data ?? []) as RestrictionRow[];
  const profileIds = [...new Set([
    ...reports.flatMap((report) => [report.reporter_id, report.reported_user_id, ...(report.reviewed_by ? [report.reviewed_by] : [])]),
    ...restrictions.map((restriction) => restriction.user_id),
  ])];
  const [{ data: profiles }, { data: ratings }] = profileIds.length ? await Promise.all([
    admin.from("profiles").select("id,nickname,grade_level").in("id", profileIds),
    admin.from("battle_ratings").select("user_id,rating").in("user_id", profileIds),
  ]) : [{ data: [] }, { data: [] }];
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const ratingMap = new Map((ratings ?? []).map((rating) => [rating.user_id, rating.rating]));
  const statusCounts = new Map(STATUSES.map((item, index) => [item, countResults[index]?.count ?? 0]));

  return <div className="flex flex-col gap-6">
    <Header />
    {params.error && <div className="flex gap-2 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" />{ERRORS[params.error] ?? "신고 처리 작업을 완료하지 못했습니다."}</div>}
    {params.updated && <div className="flex gap-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" />{params.updated === "lifted" ? "채팅 제한을 해제하고 사용자에게 알렸습니다." : params.updated === "reviewing" ? "신고 검토를 시작하고 감사 로그를 남겼습니다." : "처리 결과와 운영 조치, 사용자 알림을 저장했습니다."}</div>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {STATUSES.map((item) => <Link key={item} href={`/developer/reports?status=${item}`}><Metric label={item} value={statusCounts.get(item) ?? 0} active={status === item} /></Link>)}
      <Metric label="restricted users" value={restrictions.length} active={false} />
    </div>

    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">신고 검색</CardTitle></CardHeader><CardContent><form className="grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select name="status" defaultValue={status} className={selectClass}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" /><Input name="q" defaultValue={q} className="border-zinc-700 bg-zinc-950 pl-9" placeholder="신고 사유 검색" /></div><Button type="submit" variant="outline">필터 적용</Button></form></CardContent></Card>

    <div className="flex flex-col gap-4">
      {!reports.length && <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-14 text-center text-sm text-zinc-500">해당 상태의 신고가 없습니다.</div>}
      {reports.map((report) => {
        const reporter = profileMap.get(report.reporter_id);
        const reported = profileMap.get(report.reported_user_id);
        return <Card key={report.id} className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><MessageSquareWarning className="h-4 w-4 text-amber-400" />{CATEGORY_LABELS[report.category] ?? report.category}<StatusBadge status={report.status} /></CardTitle><p className="mt-1 text-xs text-zinc-500">{new Date(report.created_at).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "medium" })} · 신고 ID {report.id}</p></div>{report.status === "pending" && <form action={startDeveloperMessageReportReview}><input type="hidden" name="report_id" value={report.id} /><Button type="submit" size="sm" variant="outline"><Eye className="h-3.5 w-3.5" />검토 시작</Button></form>}</div></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Person label="신고자" id={report.reporter_id} nickname={reporter?.nickname} grade={reporter?.grade_level} rating={ratingMap.get(report.reporter_id)} />
              <Person label="신고 대상" id={report.reported_user_id} nickname={reported?.nickname} grade={reported?.grade_level} rating={ratingMap.get(report.reported_user_id)} danger />
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">신고된 메시지 원문</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{report.message_snapshot}</p></div>
            <div className="rounded-xl bg-amber-950/20 p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">신고 사유</p><p className="mt-2 whitespace-pre-wrap text-sm text-amber-100/80">{report.reason}</p></div>
            {report.resolution && <div className="rounded-xl bg-emerald-950/20 p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">처리 결과</p><p className="mt-2 text-sm text-emerald-100/80">{report.resolution}</p></div>}
            {["pending", "reviewing"].includes(report.status) && <form action={resolveDeveloperMessageReport} className="grid gap-3 border-t border-zinc-800 pt-4">
              <input type="hidden" name="report_id" value={report.id} />
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs text-zinc-400">처리 상태<select name="status" defaultValue="resolved" className={selectClass}><option value="resolved">조치 완료</option><option value="dismissed">신고 기각</option></select></label><label className="grid gap-1.5 text-xs text-zinc-400">운영 조치<select name="moderation_action" defaultValue="warn" className={selectClass}><option value="none">추가 조치 없음</option><option value="warn">경고 알림</option><option value="restrict_1d">채팅 1일 제한</option><option value="restrict_7d">채팅 7일 제한</option><option value="restrict_30d">채팅 30일 제한</option><option value="restrict_permanent">채팅 영구 제한</option></select></label></div>
              <label className="grid gap-1.5 text-xs text-zinc-400">판단 근거 및 사용자 안내<Input name="resolution" required minLength={3} maxLength={500} className="border-zinc-700 bg-zinc-950" placeholder="확인한 내용과 조치 사유를 구체적으로 기록" /></label>
              <div className="flex justify-end"><Button type="submit"><ShieldCheck className="h-4 w-4" />처리 결과 저장</Button></div>
            </form>}
          </CardContent>
        </Card>;
      })}
    </div>

    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ban className="h-4 w-4 text-red-400" />현재 채팅 제한 사용자</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">
      {!restrictions.length && <p className="py-6 text-center text-sm text-zinc-500">현재 적용 중인 채팅 제한이 없습니다.</p>}
      {restrictions.map((restriction) => {
        const profile = profileMap.get(restriction.user_id);
        return <div key={restriction.user_id} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] lg:items-center"><div><Link href={`/users/${restriction.user_id}`} className="font-semibold text-red-300 hover:underline">{profile?.nickname ?? restriction.user_id}</Link><p className="mt-1 text-xs text-zinc-500">{restriction.restricted_until ? `${new Date(restriction.restricted_until).toLocaleString("ko-KR")}까지` : "영구 제한"} · {restriction.reason}</p></div><form action={liftDeveloperChatRestriction} className="flex gap-2"><input type="hidden" name="user_id" value={restriction.user_id} /><Input name="reason" required minLength={3} maxLength={300} className="border-zinc-700 bg-zinc-900" placeholder="제한 해제 사유" /><Button type="submit" size="sm" variant="outline">제한 해제</Button></form></div>;
      })}
    </CardContent></Card>
  </div>;
}

function Header() {
  return <div><h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldAlert className="h-6 w-6 text-emerald-400" />Chat Reports</h1><p className="mt-1 text-sm text-zinc-400">신고된 메시지 원문과 사유를 검토하고 사용자 보호 조치를 적용합니다.</p></div>;
}

function Metric({ label, value, active }: { label: string; value: number; active: boolean }) {
  return <Card className={`${active ? "border-emerald-700 bg-emerald-950/30" : "border-zinc-800 bg-zinc-900"} text-zinc-100`}><CardContent className="p-4"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs capitalize text-zinc-500">{label}</p></CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "pending" ? "border-amber-800 text-amber-300"
    : status === "reviewing" ? "border-sky-800 text-sky-300"
      : status === "resolved" ? "border-emerald-800 text-emerald-300"
        : "border-zinc-700 text-zinc-400";
  const Icon = status === "pending" ? Clock3 : status === "resolved" ? CheckCircle2 : status === "reviewing" ? Eye : ShieldAlert;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-normal ${classes}`}><Icon className="h-3 w-3" />{status}</span>;
}

function Person({ label, id, nickname, grade, rating, danger = false }: { label: string; id: string; nickname?: string; grade?: string | null; rating?: number; danger?: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3"><span className={`flex h-9 w-9 items-center justify-center rounded-full ${danger ? "bg-red-950 text-red-300" : "bg-zinc-800 text-zinc-300"}`}><UserRound className="h-4 w-4" /></span><div><p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p><Link href={`/users/${id}`} className={`text-sm font-semibold hover:underline ${danger ? "text-red-300" : "text-zinc-200"}`}>{nickname ?? id}</Link><p className="text-[11px] text-zinc-500">{grade || "학년 미설정"} · Rating {rating ?? 1200}</p></div></div>;
}

const selectClass = "h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm";
