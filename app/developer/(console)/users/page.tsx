import Link from "next/link";
import { Activity, AlertTriangle, Ban, CheckCircle2, Crown, Search, Shield, SlidersHorizontal, UsersRound } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { adjustDeveloperRating, deleteSuperAdminUser, setSuperAdminUserBan, updateDeveloperUser } from "../../actions";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { isSuperAdminRole } from "@/lib/developer/roles";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { ConfirmSubmitButton } from "@/components/developer/confirm-submit-button";

export const metadata = { title: "Developer Users" };

type UserRow = {
  id: string; nickname: string; avatar_url: string | null; grade_level: string | null;
  role: string; plan: string; created_at: string;
  is_banned?: boolean; banned_at?: string | null; banned_until?: string | null;
  ban_reason?: string | null; banned_by?: string | null;
};

const ERRORS: Record<string, string> = {
  invalid_user_settings: "사용자 권한 또는 플랜 값이 올바르지 않습니다.",
  self_demotion: "현재 개발자 계정은 스스로 관리자 권한을 해제할 수 없습니다.",
  user_update_failed: "사용자 설정을 저장하지 못했습니다.",
  invalid_rating: "Rating은 100~5000, 조정 사유는 3~200자로 입력해주세요.",
  rating_adjust_failed: "Rating 조정에 실패했습니다. 데이터베이스 상태를 확인해주세요.",
  super_admin_required: "사용자 역할 변경은 최고 운영자만 실행할 수 있습니다.",
  invalid_role_reason: "역할 변경 사유를 5~300자로 입력해주세요.",
  last_super_admin: "현재 최고 운영자 자기 자신 또는 마지막 최고 운영자는 강등할 수 없습니다.",
  super_admin_migration_required: "최고 운영자 역할 관리 DB 업데이트가 필요합니다.",
  invalid_ban: "밴 대상과 사유를 확인해주세요. 현재 계정은 밴할 수 없습니다.",
  invalid_ban_expiry: "밴 해제 예정 시각은 현재보다 이후여야 합니다.",
  protected_operator: "현재 계정 또는 마지막 Super Admin은 밴·삭제할 수 없습니다.",
  moderation_migration_required: "사용자 밴 기능 DB 업데이트가 필요합니다.",
  ban_update_failed: "사용자 밴 상태를 변경하지 못했습니다.",
  invalid_user_deletion: "삭제 대상과 사유를 확인해주세요.",
  deletion_confirmation: "영구 삭제 확인란에 대상 사용자의 닉네임을 정확히 입력해주세요.",
  user_deletion_failed: "사용자 계정을 영구 삭제하지 못했습니다.",
};

export default async function DeveloperUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; updated?: string; compat?: string; warning?: string }> }) {
  const { admin, user, profile: actorProfile } = await requireDeveloper();
  const isSuperAdmin = isSuperAdminRole(actorProfile.role);
  const { q = "", error, updated, compat, warning } = await searchParams;
  const queryText = q.trim().slice(0, 50);
  let query = admin.from("profiles").select("id, nickname, avatar_url, grade_level, role, plan, created_at, is_banned, banned_at, banned_until, ban_reason, banned_by")
    .order("created_at", { ascending: false }).limit(100);
  if (queryText) query = query.ilike("nickname", `%${queryText}%`);
  const userResult = await query;
  let moderationSchemaReady = true;
  let users = (userResult.data ?? []) as UserRow[];
  if (userResult.error && isMissingSchemaError(userResult.error)) {
    moderationSchemaReady = false;
    let fallback = admin.from("profiles").select("id, nickname, avatar_url, grade_level, role, plan, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (queryText) fallback = fallback.ilike("nickname", `%${queryText}%`);
    const fallbackResult = await fallback;
    users = (fallbackResult.data ?? []) as UserRow[];
  }
  const ids = users.map((row) => row.id);
  const { data: ratings } = ids.length
    ? await admin.from("battle_ratings").select("user_id, rating, peak_rating, games").in("user_id", ids)
    : { data: [] };
  const ratingMap = new Map((ratings ?? []).map((rating) => [rating.user_id, rating]));
  const { error: reasonColumnError } = await admin.from("battle_rating_history").select("id,reason").limit(1);

  return <div className="flex flex-col gap-6">
    <div><h1 className="flex items-center gap-2 text-2xl font-bold"><UsersRound className="h-6 w-6 text-emerald-400" />User Administration</h1><p className="mt-1 text-sm text-zinc-400">권한, 플랜, Rating을 관리합니다. 모든 변경은 감사 로그에 기록됩니다.</p></div>
    {isSuperAdmin && <div className="flex gap-3 rounded-xl border border-violet-900 bg-violet-950/20 p-4 text-sm text-violet-200"><Crown className="h-5 w-5 shrink-0 text-violet-300" /><div><strong>최고 운영자 권한</strong><p className="mt-1 text-xs text-violet-200/70">역할 승격·강등, 계정 밴·해제 및 영구 삭제를 실행할 수 있습니다. 밴 사용자는 서비스 접근과 모든 리더보드에서 제외되며, 모든 조치는 사유와 함께 감사 로그에 기록됩니다.</p></div></div>}
    {error && <div className="flex items-start gap-2 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{ERRORS[error] ?? "관리 작업을 완료하지 못했습니다."}</div>}
    {updated && <div className="flex items-start gap-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{{ rating: "Rating과 사용자 알림을 저장했습니다.", banned: "사용자를 밴하고 서비스·리더보드 접근을 차단했습니다.", unbanned: "사용자 밴을 해제했습니다.", deleted: "사용자 계정과 연결 데이터를 영구 삭제했습니다." }[updated] ?? "사용자 권한과 플랜을 저장했습니다."}{compat && " 현재 DB가 이전 버전이어서 호환 모드로 처리했습니다."}</div>}
    {warning === "notification" && <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">Rating은 저장됐지만 알림 전송에 실패했습니다. notifications 테이블 정책을 확인해주세요.</div>}
    {reasonColumnError && <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><strong>DB 호환 모드</strong><p className="mt-1 text-xs text-amber-200/70">`0022_rating_notifications.sql`이 아직 적용되지 않았습니다. Rating 조정과 알림 전송은 서버 호환 경로로 동작하지만, 사유를 Rating History에 보관하려면 마이그레이션을 적용해야 합니다.</p></div>}
    {isSuperAdmin && !moderationSchemaReady && <div className="rounded-xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200"><strong>사용자 제재 DB 업데이트 필요</strong><p className="mt-1 text-xs text-amber-200/70">`0028_super_admin_bans_deletions.sql` 적용 후 밴·랭킹 제외·공개 프로필 차단 기능을 사용할 수 있습니다.</p></div>}
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">사용자 검색</CardTitle><form className="flex gap-2 pt-2"><div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" /><Input name="q" defaultValue={queryText} className="border-zinc-700 bg-zinc-950 pl-9" placeholder="닉네임 검색" /></div><Button type="submit" variant="outline">검색</Button></form></CardHeader><CardContent className="flex flex-col gap-3">
      {users.map((profile) => {
        const rating = ratingMap.get(profile.id);
        const currentRating = rating?.rating ?? 1200;
        const isBanned = Boolean(profile.is_banned && (!profile.banned_until || new Date(profile.banned_until).getTime() > Date.now()));
        return <div key={profile.id} className={`rounded-xl border bg-zinc-950 p-4 ${isBanned ? "border-red-900/80" : "border-zinc-800"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href={`/users/${profile.id}`} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 font-bold"><Avatar src={profile.avatar_url} size={40} fallback={profile.nickname[0]} /></Link><div><div className="flex flex-wrap items-center gap-2"><RatingName nickname={profile.nickname} rating={currentRating} userId={profile.id} />{isBanned && <Badge variant="warning" className="border-red-800 bg-red-950 text-red-300"><Ban className="mr-1 h-3 w-3" />Banned</Badge>}</div><p className="text-xs text-zinc-500">{profile.grade_level || "학년 미설정"} · {profile.id === user.id ? "현재 계정" : new Date(profile.created_at).toLocaleDateString("ko-KR")}</p>{isBanned && <p className="mt-1 text-[11px] text-red-300">{profile.ban_reason} · {profile.banned_until ? `${new Date(profile.banned_until).toLocaleString("ko-KR")}까지` : "영구"}</p>}</div></div><div className="flex items-center gap-2"><Button asChild size="sm" variant="outline"><Link href={`/developer/ratings?q=${profile.id}`}><Activity className="h-3.5 w-3.5" />이력</Link></Button><RatingBadge rating={currentRating} /><Badge variant={profile.role === "super_admin" ? "warning" : profile.role === "admin" ? "secondary" : "outline"}>{profile.role === "super_admin" && <Crown className="mr-1 h-3 w-3" />}{profile.role}</Badge><Badge variant="outline">{profile.plan}</Badge></div></div>
          <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 lg:grid-cols-2">
            <form action={updateDeveloperUser} className={isSuperAdmin ? "grid gap-2 sm:grid-cols-[120px_100px_1fr_auto]" : "grid grid-cols-[1fr_auto] gap-2"}><input type="hidden" name="user_id" value={profile.id} />{isSuperAdmin ? <><select name="role" defaultValue={profile.role} className={selectClass}><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select><select name="plan" defaultValue={profile.plan} className={selectClass}><option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option></select><Input name="role_reason" minLength={5} maxLength={300} className={inputClass} placeholder="역할 변경 시 사유 필수" /></> : <><input type="hidden" name="role" value={profile.role} /><select name="plan" defaultValue={profile.plan} className={selectClass}><option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option></select></>}<Button type="submit" size="sm" variant="outline"><Shield className="h-3.5 w-3.5" />저장</Button></form>
            <form action={adjustDeveloperRating} className="grid grid-cols-[90px_1fr_auto] gap-2"><input type="hidden" name="user_id" value={profile.id} /><Input name="rating" type="number" min={100} max={5000} defaultValue={currentRating} className={inputClass} /><Input name="reason" minLength={3} maxLength={200} className={inputClass} placeholder="조정 사유" /><Button type="submit" size="sm" variant="outline"><SlidersHorizontal className="h-3.5 w-3.5" />조정</Button></form>
          </div>
          {isSuperAdmin && moderationSchemaReady && profile.id !== user.id && <details className="mt-4 rounded-xl border border-red-900/50 bg-red-950/10 p-4">
            <summary className="cursor-pointer text-xs font-semibold text-red-300">Super Admin 제재·삭제</summary>
            <form action={setSuperAdminUserBan} className="mt-4 grid gap-2 sm:grid-cols-[170px_1fr_auto]">
              <input type="hidden" name="user_id" value={profile.id} />
              <input type="hidden" name="banned" value={String(!isBanned)} />
              {!isBanned && <input name="banned_until" type="datetime-local" className={selectClass} aria-label="밴 해제 예정 시각, 비우면 영구" />}
              <Input name="reason" required minLength={5} maxLength={500} className={inputClass} placeholder={isBanned ? "밴 해제 사유" : "밴 사유 — 기간을 비우면 영구 밴"} />
              <Button type="submit" size="sm" variant={isBanned ? "outline" : "destructive"}><Ban className="h-3.5 w-3.5" />{isBanned ? "밴 해제" : "사용자 밴"}</Button>
            </form>
            {profile.role !== "super_admin" ? <form action={deleteSuperAdminUser} className="mt-4 grid gap-2 border-t border-red-900/40 pt-4 lg:grid-cols-[1fr_180px_auto]">
              <input type="hidden" name="user_id" value={profile.id} />
              <Input name="reason" required minLength={5} maxLength={500} className={inputClass} placeholder="영구 삭제 사유" />
              <Input name="confirmation" required className={inputClass} placeholder={`확인: ${profile.nickname}`} />
              <ConfirmSubmitButton message={`${profile.nickname} 계정과 학습·메시지·Rating 등 연결 데이터를 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?`} />
            </form> : <p className="mt-4 border-t border-red-900/40 pt-4 text-[11px] text-red-300/70">Super Admin 계정은 바로 삭제할 수 없습니다. 다른 활성 Super Admin이 먼저 Admin 또는 User로 강등한 뒤 삭제해야 합니다.</p>}
          </details>}
        </div>;
      })}
    </CardContent></Card>
  </div>;
}

const inputClass = "border-zinc-700 bg-zinc-950";
const selectClass = "h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs";
