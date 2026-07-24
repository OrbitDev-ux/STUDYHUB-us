import Link from "next/link";
import { Activity, ArrowRight, BookOpenCheck, Crown, Database, FileQuestion, FlaskConical, ShieldAlert, Swords, UsersRound } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { isSuperAdminRole } from "@/lib/developer/roles";
import { setDeveloperMaintenanceMode } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDeveloperSchemaStatus } from "@/lib/developer/schema-status";

export const metadata = { title: "Developer Overview" };

export default async function DeveloperOverviewPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { admin, profile } = await requireDeveloper();
  const params = await searchParams;
  const isSuperAdmin = isSuperAdminRole(profile.role);
  const schema = await getDeveloperSchemaStatus(admin);
  const [
    { count: users },
    { count: questions },
    { count: publishedQuestions },
    { count: contests },
    { count: activeContests },
    { count: battles },
    { count: codingBattles },
    { count: pendingReports },
    { count: judgeProblems },
    { data: audits },
    { data: appSettings },
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("questions").select("id", { count: "exact", head: true }),
    admin.from("questions").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("contests").select("id", { count: "exact", head: true }),
    admin.from("contests").select("id", { count: "exact", head: true }).eq("publication_status", "published").gt("ends_at", new Date().toISOString()),
    admin.from("battle_matches").select("id", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("coding_battle_matches").select("id", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("message_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("oj_problems").select("id", { count: "exact", head: true }),
    admin.from("developer_audit_logs").select("id, action, target_type, target_id, created_at").order("created_at", { ascending: false }).limit(12),
    admin.from("app_settings").select("maintenance_mode, maintenance_message").eq("id", true).single(),
  ]);
  return <div className="flex flex-col gap-6">
    <div><h1 className="text-2xl font-bold">Developer Overview</h1><p className="mt-1 text-sm text-zinc-400">서비스 콘텐츠와 운영 상태를 한곳에서 관리합니다.</p></div>
    {params.error && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{params.error === "super_admin_required" ? "이 작업은 최고 운영자 권한이 필요합니다." : "시스템 설정을 저장하지 못했습니다."}</p>}
    {params.updated && <p className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">시스템 설정을 저장했습니다.</p>}
    {isSuperAdmin && <Card className="border-violet-900 bg-violet-950/20 text-violet-100"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex gap-3"><Crown className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" /><div><h2 className="font-semibold">Super Admin 권한 활성화</h2><p className="mt-1 text-xs text-violet-200/70">모든 관리자 기능과 함께 역할 승격·강등, 감사 로그 수정·보관·복원 권한을 사용할 수 있습니다.</p></div></div><Button asChild variant="outline"><Link href="/developer/users">운영자 권한 관리<ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>}
    <Card className="border-emerald-900 bg-emerald-950/20 text-zinc-100"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-950"><BookOpenCheck className="h-5 w-5 text-emerald-400" /></span><div><h2 className="font-semibold">처음 사용하는 관리자이신가요?</h2><p className="mt-1 text-xs text-zinc-400">기능 설명표, 권장 운영 순서와 안전 원칙을 먼저 확인하세요.</p></div></div><Button asChild variant="outline"><Link href="/developer/guide">운영 가이드 열기<ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>
    {!Object.values(schema).every(Boolean) && <Card className="border-amber-900 bg-amber-950/30 text-amber-100"><CardHeader><CardTitle className="text-base">Database Upgrade Required</CardTitle></CardHeader><CardContent><p className="text-sm text-amber-200/80">원격 Supabase에 최신 개발자 콘솔 스키마가 모두 적용되지 않았습니다. 핵심 기능은 호환 모드로 처리하며, 전체 기능 활성화를 위해 `0021_developer_console.sql`부터 `0035_discord_code_linking.sql`까지 순서대로 적용하세요.</p><div className="mt-3 flex flex-wrap gap-2 text-[11px]">{Object.entries(schema).map(([name, ready]) => <span key={name} className={`rounded-full border px-2 py-1 ${ready ? "border-emerald-800 text-emerald-300" : "border-amber-800 text-amber-300"}`}>{ready ? "✓" : "!"} {name}</span>)}</div></CardContent></Card>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
      <Metric icon={UsersRound} label="Users" value={users ?? 0} />
      <Metric icon={FileQuestion} label="Questions" value={questions ?? 0} sub={`${publishedQuestions ?? 0} published`} />
      <Metric icon={Swords} label="Contests" value={contests ?? 0} sub={`${activeContests ?? 0} open`} />
      <Metric icon={Activity} label="Battles" value={(battles ?? 0) + (codingBattles ?? 0)} sub={`${codingBattles ?? 0} coding`} />
      <Metric icon={ShieldAlert} label="Chat Reports" value={pendingReports ?? 0} sub="pending" />
      <Metric icon={FlaskConical} label="Judge Problems" value={judgeProblems ?? 0} />
      <Metric icon={Database} label="Database" value="Supabase" sub="connected" />
    </div>
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">Recent Audit Log</CardTitle></CardHeader><CardContent className="flex flex-col gap-1">{(audits ?? []).length === 0 && <p className="text-sm text-zinc-500">기록이 없습니다.</p>}{(audits ?? []).map((audit) => <div key={audit.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-zinc-950 px-3 py-2 text-xs"><div><strong className="text-emerald-300">{audit.action}</strong><span className="ml-2 text-zinc-500">{audit.target_type} · {audit.target_id || "-"}</span></div><time className="text-zinc-500">{new Date(audit.created_at).toLocaleString("ko-KR")}</time></div>)}</CardContent></Card>
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">System Control</CardTitle></CardHeader><CardContent><form action={setDeveloperMaintenanceMode} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={appSettings?.maintenance_mode ?? false} />Maintenance</label><Input name="message" defaultValue={appSettings?.maintenance_message ?? ""} maxLength={500} className="border-zinc-700 bg-zinc-950" placeholder="점검 안내 메시지" /><Button type="submit" variant="outline">시스템 상태 저장</Button></form></CardContent></Card>
  </div>;
}

function Metric({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardContent className="p-4"><Icon className="h-4 w-4 text-emerald-400" /><p className="mt-3 text-2xl font-bold">{value}</p><p className="text-xs text-zinc-400">{label}</p>{sub && <p className="mt-1 text-[10px] text-zinc-600">{sub}</p>}</CardContent></Card>;
}
