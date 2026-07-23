import { AlertTriangle, CheckCircle2, Megaphone, Send, UsersRound } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { sendDeveloperAnnouncement } from "../../actions";
import { GRADE_LEVELS } from "@/lib/practice/question-bank";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Developer Announcements" };

const ERRORS: Record<string, string> = {
  invalid_announcement: "제목·본문과 수신 대상을 확인해주세요.",
  announcement_failed: "공지 알림 발송에 실패했습니다.",
  no_recipients: "조건에 맞는 수신자가 없습니다.",
};

export default async function DeveloperNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { admin } = await requireDeveloper();
  const { error, sent } = await searchParams;
  const [{ data: users }, recentResult] = await Promise.all([
    admin.from("profiles").select("id,nickname,grade_level").order("created_at", { ascending: false }).limit(200),
    admin.from("developer_audit_logs")
      .select("id,details,created_at")
      .eq("action", "notification.broadcast")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const auditUnavailable = Boolean(recentResult.error && isMissingSchemaError(recentResult.error));

  return <div className="flex flex-col gap-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Megaphone className="h-6 w-6 text-emerald-400" />Announcements</h1><p className="mt-1 text-sm text-zinc-400">전체, 학년별 또는 개별 사용자에게 실시간 서비스 공지를 발송합니다.</p></div>
    {error && <div className="flex gap-2 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" />{ERRORS[error] ?? "공지 발송을 완료하지 못했습니다."}</div>}
    {sent && <div className="flex gap-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" />{Number(sent).toLocaleString("ko-KR")}명에게 공지를 발송했습니다.</div>}
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4 text-emerald-400" />새 공지 발송</CardTitle></CardHeader>
      <CardContent>
        <form action={sendDeveloperAnnouncement} className="grid gap-4">
          <label className="grid gap-1.5 text-xs text-zinc-400">제목<Input name="title" required minLength={2} maxLength={100} className={inputClass} placeholder="서비스 공지 제목" /></label>
          <label className="grid gap-1.5 text-xs text-zinc-400">본문<textarea name="body" required minLength={2} maxLength={1000} rows={6} className={textareaClass} placeholder="사용자 알림함에 표시할 내용" /></label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5 text-xs text-zinc-400">수신 범위<select name="audience" defaultValue="all" className={selectClass}><option value="all">전체 사용자</option><option value="grade">특정 학년</option><option value="user">개별 사용자</option></select></label>
            <label className="grid gap-1.5 text-xs text-zinc-400">학년<select name="grade_level" defaultValue="중1" className={selectClass}>{GRADE_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs text-zinc-400">개별 사용자<Input name="user_id" list="announcement-users" className={inputClass} placeholder="사용자 UUID 입력 또는 선택" /><datalist id="announcement-users">{(users ?? []).map((user) => <option key={user.id} value={user.id}>{user.nickname} · {user.grade_level || "학년 미설정"}</option>)}</datalist></label>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-500"><span>발송 즉시 알림 벨에 실시간으로 나타나며 되돌릴 수 없습니다.</span><Button type="submit"><Send className="h-4 w-4" />공지 발송</Button></div>
        </form>
      </CardContent>
    </Card>
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UsersRound className="h-4 w-4 text-emerald-400" />최근 발송 이력</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {auditUnavailable && <p className="rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-200">`0021_developer_console.sql` 적용 전에는 발송은 가능하지만 이력 목록은 저장되지 않습니다.</p>}
        {(recentResult.data ?? []).map((log) => {
          const details = (log.details ?? {}) as Record<string, unknown>;
          return <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-950 px-3 py-2 text-xs"><div><strong className="text-zinc-200">{String(details.title ?? "공지")}</strong><span className="ml-2 text-zinc-500">{String(details.audience ?? "all")} · {Number(details.recipientCount ?? 0)}명</span></div><time className="text-zinc-500">{new Date(log.created_at).toLocaleString("ko-KR")}</time></div>;
        })}
      </CardContent>
    </Card>
  </div>;
}

const inputClass = "border-zinc-700 bg-zinc-950";
const selectClass = "h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm";
const textareaClass = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500";
