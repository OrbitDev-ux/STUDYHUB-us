import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  PencilLine,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { isSuperAdminRole } from "@/lib/developer/roles";
import { setSuperAdminAuditArchive, updateSuperAdminAuditLog } from "../../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEVELOPER_AUDIT_ACTIONS, DEVELOPER_AUDIT_CATALOG } from "@/lib/developer/audit-catalog";

export const metadata = { title: "Developer Audit Log" };

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  edited_at?: string | null;
  edited_by?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;
};

type RevisionRow = {
  id: string;
  audit_log_id: string;
  actor_id: string | null;
  operation: "update" | "archive" | "restore";
  reason: string;
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 40;
const ACTIONS = ["all", ...DEVELOPER_AUDIT_ACTIONS];
const CATALOG = new Map(DEVELOPER_AUDIT_CATALOG.map((entry) => [entry.action, entry]));
const MODERN_COLUMNS = "id,actor_id,action,target_type,target_id,details,created_at,edited_at,edited_by,archived_at,archived_by,archive_reason";
const LEGACY_COLUMNS = "id,actor_id,action,target_type,target_id,details,created_at";
const ERRORS: Record<string, string> = {
  invalid_edit: "작업 코드·대상·수정 사유를 확인해주세요.",
  invalid_json: "세부 데이터는 올바른 JSON 객체 형식이어야 합니다.",
  invalid_archive: "보관·복원 사유를 5~500자로 입력해주세요.",
  super_admin_migration_required: "최고 운영자 감사 로그 편집 DB 업데이트가 필요합니다.",
  edit_failed: "감사 로그를 수정하지 못했습니다.",
  archive_failed: "감사 로그의 보관 상태를 변경하지 못했습니다.",
};

export default async function DeveloperAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    action?: string;
    target?: string;
    scope?: string;
    page?: string;
    error?: string;
    updated?: string;
  }>;
}) {
  const { admin, profile } = await requireDeveloper();
  const params = await searchParams;
  const isSuperAdmin = isSuperAdminRole(profile.role);
  const q = (params.q ?? "").trim().replace(/[,%()]/g, "").slice(0, 80);
  const action = ACTIONS.includes(params.action ?? "") ? params.action! : "all";
  const target = (params.target ?? "").trim().replace(/[,%()]/g, "").slice(0, 40);
  const scope = ["active", "all", "archived"].includes(params.scope ?? "") ? params.scope! : "active";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const buildQuery = (columns: string, supportsArchive: boolean) => {
    let query = admin.from("developer_audit_logs")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (action !== "all") query = query.eq("action", action);
    if (q) query = query.ilike("action", `%${q}%`);
    if (target) query = query.or(`target_type.ilike.%${target}%,target_id.ilike.%${target}%`);
    if (supportsArchive && scope === "active") query = query.is("archived_at", null);
    if (supportsArchive && scope === "archived") query = query.not("archived_at", "is", null);
    return query;
  };

  let result = await buildQuery(MODERN_COLUMNS, true);
  let revisionSchemaReady = true;
  if (result.error && isMissingSchemaError(result.error)) {
    revisionSchemaReady = false;
    result = await buildQuery(LEGACY_COLUMNS, false);
  }
  if (result.error && isMissingSchemaError(result.error)) {
    return <div className="flex flex-col gap-6">
      <Header isSuperAdmin={isSuperAdmin} />
      <div className="flex gap-3 rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div><strong>감사 로그 스키마 적용이 필요합니다.</strong><p className="mt-1 text-amber-200/70">Supabase에 `0021_developer_console.sql`을 적용하면 관리자 작업이 실행자·대상·사유·접속 정보와 함께 기록됩니다.</p></div>
      </div>
    </div>;
  }

  const audits = (result.data ?? []) as unknown as AuditRow[];
  const auditIds = audits.map((row) => row.id);
  const { data: revisionData } = isSuperAdmin && revisionSchemaReady && auditIds.length
    ? await admin.from("developer_audit_log_revisions")
      .select("id,audit_log_id,actor_id,operation,reason,before_snapshot,after_snapshot,created_at")
      .in("audit_log_id", auditIds)
      .order("created_at", { ascending: false })
    : { data: [] };
  const revisions = (revisionData ?? []) as RevisionRow[];
  const revisionsByAudit = new Map<string, RevisionRow[]>();
  for (const revision of revisions) {
    revisionsByAudit.set(revision.audit_log_id, [...(revisionsByAudit.get(revision.audit_log_id) ?? []), revision]);
  }

  const actorIds = [...new Set([
    ...audits.flatMap((row) => row.actor_id ? [row.actor_id] : []),
    ...audits.flatMap((row) => [row.edited_by, row.archived_by].filter((id): id is string => Boolean(id))),
    ...revisions.flatMap((row) => row.actor_id ? [row.actor_id] : []),
  ])];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id,nickname").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor.nickname]));
  const totalPages = Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE));
  const queryParams = new URLSearchParams();
  if (q) queryParams.set("q", q);
  if (action !== "all") queryParams.set("action", action);
  if (target) queryParams.set("target", target);
  if (scope !== "active") queryParams.set("scope", scope);
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(queryParams);
    next.set("page", String(nextPage));
    return `/developer/audit?${next}`;
  };

  return <div className="flex flex-col gap-6">
    <Header isSuperAdmin={isSuperAdmin} />
    {params.error && <div className="flex items-start gap-2 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{ERRORS[params.error] ?? "감사 로그 작업을 완료하지 못했습니다."}</div>}
    {params.updated && <div className="flex items-start gap-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />감사 로그 변경을 적용하고 변경 전·후 원본을 개정 이력에 보존했습니다.</div>}
    {isSuperAdmin && !revisionSchemaReady && <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><strong>최고 운영자 편집 기능 DB 업데이트 필요</strong><p className="mt-1 text-xs opacity-75">`0027_super_admin_permissions_audit_revisions.sql` 적용 전에는 감사 로그를 조회만 할 수 있습니다.</p></div>}

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="검색 결과" value={result.count ?? 0} />
      <Metric label="현재 페이지" value={`${page} / ${totalPages}`} />
      <Metric label="표시 중" value={audits.length} />
    </div>
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="text-base">로그 필터</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-2 md:grid-cols-[1fr_220px_180px_140px_auto]">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" /><Input name="q" defaultValue={q} className="border-zinc-700 bg-zinc-950 pl-9" placeholder="작업명 검색" /></div>
          <select name="action" defaultValue={action} className={selectClass}>{ACTIONS.map((item) => <option key={item} value={item}>{item === "all" ? "모든 작업" : `${item} — ${CATALOG.get(item)?.label ?? ""}`}</option>)}</select>
          <Input name="target" defaultValue={target} className="border-zinc-700 bg-zinc-950" placeholder="대상 유형" />
          <select name="scope" defaultValue={scope} className={selectClass}><option value="active">활성 로그</option><option value="all">전체 로그</option><option value="archived">보관 로그</option></select>
          <Button type="submit" variant="outline">필터 적용</Button>
        </form>
      </CardContent>
    </Card>
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="text-base">Audit Events</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!audits.length && <p className="py-10 text-center text-sm text-zinc-500">조건에 맞는 로그가 없습니다.</p>}
        {audits.map((audit) => {
          const catalog = CATALOG.get(audit.action);
          const auditRevisions = revisionsByAudit.get(audit.id) ?? [];
          return <article key={audit.id} className={`rounded-xl border bg-zinc-950 p-4 ${audit.archived_at ? "border-amber-900/70 opacity-75" : "border-zinc-800"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-semibold text-emerald-300">{audit.action}{catalog && <span className="ml-2 font-sans text-xs font-normal text-zinc-400">{catalog.label}</span>}</p>{audit.edited_at && <Badge variant="outline">Edited</Badge>}{audit.archived_at && <Badge variant="warning">Archived</Badge>}</div>
                <p className="mt-1 text-xs text-zinc-400">실행자 {audit.actor_id ? actorMap.get(audit.actor_id) ?? audit.actor_id : "system"} · 대상 {audit.target_type} / {audit.target_id ?? "-"}</p>
                {(audit.edited_at || audit.archived_at) && <p className="mt-1 text-[11px] text-zinc-500">{audit.edited_at && <>최종 편집 {new Date(audit.edited_at).toLocaleString("ko-KR")} · {audit.edited_by ? actorMap.get(audit.edited_by) ?? audit.edited_by : "system"}</>}{audit.edited_at && audit.archived_at && " · "}{audit.archived_at && <>보관 {new Date(audit.archived_at).toLocaleString("ko-KR")} · {audit.archived_by ? actorMap.get(audit.archived_by) ?? audit.archived_by : "system"}</>}</p>}
              </div>
              <time className="text-xs text-zinc-500">{new Date(audit.created_at).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "medium" })}</time>
            </div>
            {Object.keys(audit.details ?? {}).length > 0 && <details className="mt-3 rounded-lg bg-zinc-900 p-3"><summary className="cursor-pointer text-xs text-zinc-400">세부 데이터 보기</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-zinc-300">{JSON.stringify(audit.details, null, 2)}</pre></details>}
            {audit.archive_reason && <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">보관 사유: {audit.archive_reason}</p>}
            {auditRevisions.length > 0 && <details className="mt-3 rounded-lg border border-zinc-800 p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400"><History className="h-3.5 w-3.5" />개정 이력 {auditRevisions.length}건</summary><div className="mt-3 space-y-2">{auditRevisions.map((revision) => <div key={revision.id} className="rounded bg-zinc-900 p-3 text-[11px] text-zinc-400"><strong className="text-zinc-300">{revision.operation}</strong> · {revision.actor_id ? actorMap.get(revision.actor_id) ?? revision.actor_id : "system"} · {new Date(revision.created_at).toLocaleString("ko-KR")}<p className="mt-1">{revision.reason}</p><details className="mt-2 rounded border border-zinc-800 bg-zinc-950 p-2"><summary className="cursor-pointer text-violet-300">변경 전·후 원본 스냅샷</summary><div className="mt-2 grid gap-2 xl:grid-cols-2"><Snapshot label="Before" value={revision.before_snapshot} /><Snapshot label="After" value={revision.after_snapshot} /></div></details></div>)}</div></details>}
            {catalog && <p className="mt-3 border-t border-zinc-800 pt-3 text-[11px] leading-5 text-zinc-500">검증: {catalog.verify}</p>}

            {isSuperAdmin && revisionSchemaReady && <details className="mt-4 rounded-xl border border-violet-900/60 bg-violet-950/10 p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-violet-300"><ShieldCheck className="h-4 w-4" />최고 운영자 편집</summary>
              <form action={updateSuperAdminAuditLog} className="mt-4 grid gap-3">
                <input type="hidden" name="audit_log_id" value={audit.id} />
                <div className="grid gap-2 sm:grid-cols-3"><Input name="action" required minLength={2} maxLength={100} defaultValue={audit.action} className={inputClass} placeholder="action" /><Input name="target_type" required maxLength={100} defaultValue={audit.target_type} className={inputClass} placeholder="target_type" /><Input name="target_id" maxLength={200} defaultValue={audit.target_id ?? ""} className={inputClass} placeholder="target_id" /></div>
                <textarea name="details" required rows={7} defaultValue={JSON.stringify(audit.details ?? {}, null, 2)} className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs outline-none" />
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input name="reason" required minLength={5} maxLength={500} className={inputClass} placeholder="수정 사유 — 원본은 개정 이력에 보존됩니다" /><Button type="submit" size="sm"><PencilLine className="h-3.5 w-3.5" />수정 저장</Button></div>
              </form>
              <form action={setSuperAdminAuditArchive} className="mt-4 grid gap-2 border-t border-violet-900/40 pt-4 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="audit_log_id" value={audit.id} />
                <input type="hidden" name="archived" value={String(!audit.archived_at)} />
                <Input name="reason" required minLength={5} maxLength={500} className={inputClass} placeholder={audit.archived_at ? "복원 사유" : "보관 사유"} />
                <Button type="submit" size="sm" variant={audit.archived_at ? "outline" : "destructive"}>{audit.archived_at ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{audit.archived_at ? "로그 복원" : "로그 보관"}</Button>
              </form>
            </details>}
          </article>;
        })}
        <div className="mt-2 flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""}><Link href={pageHref(page - 1)}><ChevronLeft className="h-4 w-4" />이전</Link></Button>
          <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
          <Button asChild variant="outline" size="sm" className={page >= totalPages ? "pointer-events-none opacity-40" : ""}><Link href={pageHref(page + 1)}>다음<ChevronRight className="h-4 w-4" /></Link></Button>
        </div>
      </CardContent>
    </Card>
  </div>;
}

function Header({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return <div><div className="flex flex-wrap items-center gap-2"><h1 className="flex items-center gap-2 text-2xl font-bold"><ScrollText className="h-6 w-6 text-emerald-400" />Audit Log</h1>{isSuperAdmin && <Badge variant="warning"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Super Admin Editable</Badge>}</div><p className="mt-1 text-sm text-zinc-400">{isSuperAdmin ? "최고 운영자는 원본 개정 이력을 보존하면서 로그를 수정·보관·복원할 수 있습니다." : "특별 로그인 이후의 관리자 변경 이력과 사유를 추적합니다."}</p></div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardContent className="p-4"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></CardContent></Card>;
}

function Snapshot({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return <div><p className="mb-1 font-semibold text-zinc-500">{label}</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-zinc-900 p-2 text-[10px] leading-4 text-zinc-300">{JSON.stringify(value, null, 2)}</pre></div>;
}

const inputClass = "border-zinc-700 bg-zinc-950";
const selectClass = "h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm";
