import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  ShieldAlert,
} from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { deleteDeveloperRatingHistory } from "../../actions";
import { ConfirmSubmitButton } from "@/components/developer/confirm-submit-button";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Developer Rating Events" };

type RatingEventRow = {
  id: string;
  user_id: string;
  rating: number;
  rating_change: number;
  source: string;
  created_at: string;
  event_type?: string | null;
  event_id?: string | null;
  event_title?: string | null;
  reason?: string | null;
  actual_rank?: number | null;
  expected_rank?: number | null;
  performance_rating?: number | null;
  base_delta?: number | null;
  correction?: number | null;
  provisional_factor?: number | null;
};

type ProfileRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};

const PAGE_SIZE = 50;
const UUID = /^[0-9a-f-]{36}$/i;
const EVENT_TYPES = ["all", "battle", "coding_battle", "contest", "admin", "other"] as const;
const MODERN_COLUMNS = "id,user_id,rating,rating_change,source,created_at,event_type,event_id,event_title,reason,actual_rank,expected_rank,performance_rating,base_delta,correction,provisional_factor";
const LEGACY_COLUMNS = "id,user_id,rating,rating_change,source,created_at";

const ERRORS: Record<string, string> = {
  invalid_deletion: "삭제 대상과 사유를 확인해주세요. 사유는 5~300자로 입력해야 합니다.",
  protected_event: "가입 시 생성된 Rating 시작점은 삭제할 수 없습니다.",
  migration_required: "Rating 이벤트 관리 DB 마이그레이션이 적용되지 않았습니다.",
  deletion_failed: "Rating 이벤트 삭제와 재계산에 실패했습니다. 감사 로그와 DB 상태를 확인해주세요.",
};

export default async function DeveloperRatingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string; error?: string; deleted?: string }>;
}) {
  const { admin } = await requireDeveloper();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 60);
  const eventType = EVENT_TYPES.includes(params.type as (typeof EVENT_TYPES)[number])
    ? params.type as (typeof EVENT_TYPES)[number]
    : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let matchedUserIds: string[] | null = null;
  if (q) {
    if (UUID.test(q)) {
      matchedUserIds = [q];
    } else {
      const { data: matchedProfiles } = await admin.from("profiles")
        .select("id")
        .ilike("nickname", `%${q.replace(/[%_,()]/g, "")}%`)
        .limit(200);
      matchedUserIds = (matchedProfiles ?? []).map((profile) => profile.id);
    }
  }

  const buildQuery = (columns: string, modern: boolean) => {
    let query = admin.from("battle_rating_history")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (matchedUserIds) {
      query = matchedUserIds.length
        ? query.in("user_id", matchedUserIds)
        : query.eq("user_id", "00000000-0000-0000-0000-000000000000");
    }
    if (eventType === "battle") query = modern ? query.or("event_type.eq.battle,source.eq.battle") : query.eq("source", "battle");
    if (eventType === "coding_battle") query = modern ? query.or("event_type.eq.coding_battle,source.eq.coding_battle") : query.eq("source", "coding_battle");
    if (eventType === "contest") query = modern ? query.or("event_type.eq.contest,source.eq.contest") : query.eq("source", "contest");
    if (eventType === "admin") query = query.eq("source", "admin_adjustment");
    if (eventType === "other") {
      query = modern
        ? query.or("event_type.not.in.(battle,coding_battle,contest,signup),event_type.is.null").not("source", "in", "(battle,coding_battle,contest,signup,initial,backfill,admin_adjustment)")
        : query.not("source", "in", "(battle,coding_battle,contest,signup,initial,backfill,admin_adjustment)");
    }
    return query;
  };

  let result = await buildQuery(MODERN_COLUMNS, true);
  let detailedSchema = true;
  if (result.error && isMissingSchemaError(result.error)) {
    detailedSchema = false;
    result = await buildQuery(LEGACY_COLUMNS, false);
  }

  const events = (result.data ?? []) as unknown as RatingEventRow[];
  const userIds = [...new Set(events.map((event) => event.user_id))];
  const { data: profileData } = userIds.length
    ? await admin.from("profiles").select("id,nickname,avatar_url").in("id", userIds)
    : { data: [] };
  const profiles = new Map(((profileData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const capability = await admin.rpc("admin_delete_rating_history", {
    p_history_id: "00000000-0000-0000-0000-000000000000",
    p_reason: "schema capability probe",
  });
  const managementReady = !capability.error || !isMissingSchemaError(capability.error);
  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const netChange = events.reduce((sum, event) => sum + event.rating_change, 0);

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (eventType !== "all") next.set("type", eventType);
    if (target > 1) next.set("page", String(target));
    return `/developer/ratings${next.size ? `?${next}` : ""}`;
  };

  return <div className="flex flex-col gap-6">
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="h-6 w-6 text-emerald-400" />Rating Events</h1>
      <p className="mt-1 text-sm text-zinc-400">모든 사용자의 Rating 변동을 조회하고, 잘못된 이벤트를 삭제한 뒤 전체 History를 재계산합니다.</p>
    </div>

    {params.error && <div className="flex items-start gap-2 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{ERRORS[params.error] ?? "관리 작업을 완료하지 못했습니다."}</div>}
    {params.deleted && <div className="flex items-start gap-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />이벤트를 삭제하고 이후 History, 현재·최고 Rating과 rated 횟수를 재계산했습니다. 사용자 알림과 감사 로그도 저장했습니다.</div>}
    {!managementReady && <div className="flex gap-3 rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>삭제·재계산 기능 활성화가 필요합니다.</strong><p className="mt-1 text-xs text-amber-200/70">Supabase에 `0025_developer_rating_history_management.sql`을 적용하면 안전한 원자적 삭제와 그래프 즉시 반영이 활성화됩니다. 적용 전에는 조회만 가능합니다.</p></div></div>}
    {!detailedSchema && <div className="rounded-xl border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">이전 DB 스키마의 기본 History만 표시 중입니다. 상세 이벤트명·사유·Codeforces 보정값은 0022~0023 마이그레이션 적용 후 표시됩니다.</div>}

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="검색된 이벤트" value={totalCount} />
      <Metric label="현재 페이지 변화 합계" value={`${netChange > 0 ? "+" : ""}${netChange}`} />
      <Metric label="페이지" value={`${page} / ${totalPages}`} />
    </div>

    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="text-base">이벤트 검색</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" /><Input name="q" defaultValue={q} className="border-zinc-700 bg-zinc-950 pl-9" placeholder="닉네임 또는 사용자 UUID" /></div>
          <select name="type" defaultValue={eventType} className={selectClass}>
            <option value="all">모든 이벤트</option>
            <option value="battle">Battle</option>
            <option value="coding_battle">Output Judge Battle</option>
            <option value="contest">Contest</option>
            <option value="admin">Admin Adjustment</option>
            <option value="other">기타</option>
          </select>
          <Button type="submit" variant="outline">필터 적용</Button>
        </form>
      </CardContent>
    </Card>

    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="text-base">전체 Rating 변화</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!events.length && <p className="py-12 text-center text-sm text-zinc-500">조건에 맞는 Rating 이벤트가 없습니다.</p>}
        {events.map((event) => {
          const profile = profiles.get(event.user_id);
          const nickname = profile?.nickname ?? "삭제되었거나 알 수 없는 사용자";
          const before = event.rating - event.rating_change;
          const protectedEvent = event.event_type === "signup" || ["signup", "initial", "backfill"].includes(event.source);
          return <article key={event.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link href={`/users/${event.user_id}`} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 font-bold">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : nickname[0]}
                </Link>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><RatingName nickname={nickname} rating={event.rating} userId={event.user_id} /><Badge variant="outline">{event.event_type || event.source}</Badge>{protectedEvent && <Badge variant="secondary">Protected</Badge>}</div>
                  <p className="mt-1 truncate text-xs text-zinc-500">{event.event_title || sourceLabel(event.source)} · {new Date(event.created_at).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "medium" })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-zinc-500">{before} → <strong className="text-zinc-100">{event.rating}</strong></p>
                  <p className={`mt-1 flex items-center justify-end text-lg font-bold ${event.rating_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>{event.rating_change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{event.rating_change > 0 ? "+" : ""}{event.rating_change}</p>
                </div>
                <RatingBadge rating={event.rating} compact />
              </div>
            </div>

            <div className="mt-4 grid gap-2 rounded-lg bg-zinc-900 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="사유" value={event.reason || "기록된 사유 없음"} />
              <Detail label="History ID" value={event.id} mono />
              <Detail label="Origin Event" value={event.event_id || "-"} mono />
              <Detail label="Source" value={event.source} mono />
              {event.actual_rank != null && <Detail label="Actual Rank" value={formatNumber(event.actual_rank)} />}
              {event.expected_rank != null && <Detail label="Expected Rank" value={formatNumber(event.expected_rank)} />}
              {event.performance_rating != null && <Detail label="Performance" value={String(event.performance_rating)} />}
              {event.base_delta != null && <Detail label="Base Delta" value={signed(event.base_delta)} />}
              {event.correction != null && <Detail label="Correction" value={signed(event.correction)} />}
              {event.provisional_factor != null && <Detail label="Provisional" value={`×${Number(event.provisional_factor).toFixed(2)}`} />}
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-zinc-800 pt-4">
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline"><Link href={`/users/${event.user_id}`}>사용자 프로필<ExternalLink className="h-3.5 w-3.5" /></Link></Button>
                {event.event_type === "contest" && event.event_id && <Button asChild size="sm" variant="outline"><Link href={`/contests/${event.event_id}`}>대회 열기</Link></Button>}
              </div>
              {protectedEvent ? <p className="text-xs text-zinc-500">가입 시작점은 그래프 기준점이므로 삭제할 수 없습니다.</p> : managementReady ? (
                <form action={deleteDeveloperRatingHistory} className="flex w-full max-w-xl gap-2 sm:w-auto">
                  <input type="hidden" name="history_id" value={event.id} />
                  <Input name="reason" required minLength={5} maxLength={300} className="min-w-0 border-red-900/70 bg-zinc-950 sm:w-80" placeholder="삭제 근거와 재계산 사유 (필수)" />
                  <ConfirmSubmitButton message={`${nickname} 사용자의 '${event.event_title || sourceLabel(event.source)}' Rating 이벤트를 삭제하고 이후 전체 History를 재계산합니다. 계속할까요?`} />
                </form>
              ) : <Badge variant="outline">DB 적용 후 삭제 가능</Badge>}
            </div>
          </article>;
        })}

        <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-4">
          <Button asChild variant="outline" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""}><Link href={pageHref(page - 1)}><ChevronLeft className="h-4 w-4" />이전</Link></Button>
          <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
          <Button asChild variant="outline" size="sm" className={page >= totalPages ? "pointer-events-none opacity-40" : ""}><Link href={pageHref(page + 1)}>다음<ChevronRight className="h-4 w-4" /></Link></Button>
        </div>
      </CardContent>
    </Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardContent className="p-4"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-zinc-500">{label}</p></CardContent></Card>;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p><p className={`mt-1 break-all text-zinc-300 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</p></div>;
}

function sourceLabel(source: string) {
  if (source === "battle") return "Problem Battle";
  if (source === "contest") return "Rated Contest";
  if (source === "admin_adjustment") return "Admin Rating Adjustment";
  if (["signup", "initial", "backfill"].includes(source)) return "Account Created";
  return "Rating Update";
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const selectClass = "h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm";
