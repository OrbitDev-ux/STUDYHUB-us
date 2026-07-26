import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  Check,
  Code2,
  Crown,
  Search,
  Shield,
  Swords,
  Trophy,
  UserRoundPlus,
  X,
} from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { BattleArena } from "@/components/battle/battle-arena";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";
import { requestDirectBattle, respondDirectBattle } from "../actions";
import { isMissingSchemaError } from "@/lib/developer/schema-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";

export const metadata = { title: "문제풀이 배틀 시작" };

type ChallengeRow = {
  id: string;
  challenger_id: string;
  target_id: string;
  grade_level: string;
  subject_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  match_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type UserSummary = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  grade_level: string | null;
};

const SUBJECTS = [
  { id: "math", label: "수학" },
  { id: "english", label: "영어" },
  { id: "social", label: "사회" },
  { id: "science", label: "과학" },
];

const CHALLENGE_ERRORS: Record<string, string> = {
  invalid: "대결 요청 정보를 확인해주세요.",
  grade: "프로필에서 학년을 먼저 설정해주세요.",
  duplicate: "두 사용자 사이에 이미 대기 중인 대결 요청이 있습니다.",
  migration: "지정 대결 기능을 위한 DB 업데이트가 필요합니다.",
  request_failed: "대결 요청을 보내지 못했습니다.",
  response_failed: "대결 요청 상태를 변경하지 못했습니다.",
  active: "요청자 또는 상대가 이미 다른 배틀을 진행 중입니다.",
  expired: "요청이 만료되었거나 이미 처리되었습니다.",
};

export default async function BattlePlayPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    match?: string;
    challenge_error?: string;
    challenge_requested?: string;
    challenge_updated?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const q = (params.q ?? "").trim().replace(/[%_,()]/g, "").slice(0, 50);
  const initialMatchId = /^[0-9a-f-]{36}$/i.test(params.match ?? "") ? params.match! : null;
  const admin = createAdminClient();

  const [{ data: profile }, { data: rating }, challengeResult] = await Promise.all([
    supabase.from("profiles").select("grade_level").eq("id", user.id).single(),
    supabase.from("battle_ratings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("battle_challenges")
      .select("id,challenger_id,target_id,grade_level,subject_id,status,match_id,expires_at,created_at,updated_at")
      .or(`challenger_id.eq.${user.id},target_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const challengeSchemaReady = !challengeResult.error || !isMissingSchemaError(challengeResult.error);
  const now = Date.now();
  const challenges = challengeSchemaReady
    ? ((challengeResult.data ?? []) as ChallengeRow[]).filter((challenge) => (
      challenge.status === "accepted"
        ? Boolean(challenge.match_id)
        : challenge.status === "pending" && new Date(challenge.expires_at).getTime() > now
    ))
    : [];

  const { data: searchedUsers } = q && challengeSchemaReady
    ? await admin.from("profiles")
      .select("id,nickname,avatar_url,grade_level")
      .ilike("nickname", `%${q}%`)
      .neq("id", user.id)
      .order("nickname")
      .limit(12)
    : { data: [] };
  const searched = (searchedUsers ?? []) as UserSummary[];
  const relatedIds = [...new Set([
    ...challenges.flatMap((challenge) => [challenge.challenger_id, challenge.target_id]),
    ...searched.map((target) => target.id),
  ].filter((id) => id !== user.id))];
  const [{ data: relatedProfiles }, { data: relatedRatings }] = relatedIds.length
    ? await Promise.all([
      admin.from("profiles").select("id,nickname,avatar_url,grade_level").in("id", relatedIds),
      admin.from("battle_ratings").select("user_id,rating").in("user_id", relatedIds),
    ])
    : [{ data: [] }, { data: [] }];
  const userMap = new Map(((relatedProfiles ?? []) as UserSummary[]).map((item) => [item.id, item]));
  const ratingMap = new Map((relatedRatings ?? []).map((item) => [item.user_id, item.rating]));
  const incoming = challenges.filter((challenge) => challenge.target_id === user.id && challenge.status === "pending");
  const outgoing = challenges.filter((challenge) => challenge.challenger_id === user.id && challenge.status === "pending");
  const accepted = challenges.filter((challenge) => challenge.status === "accepted" && challenge.match_id);

  const myRating = rating?.rating ?? 1200;
  const games = rating?.games ?? 0;
  const winRate = games ? Math.round(((rating?.wins ?? 0) / games) * 100) : 0;

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-3"><h1 className="flex items-center gap-2 text-2xl font-bold"><Swords className="h-6 w-6 text-primary" />문제풀이 배틀</h1><RatingBadge rating={myRating} /></div><p className="mt-1 text-sm text-muted-foreground">자동 매칭을 사용하거나 원하는 사용자에게 직접 대결을 요청할 수 있습니다.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/battle/code"><Code2 className="h-4 w-4" />코딩 배틀</Link></Button><Button asChild variant="outline"><Link href="/battle"><Trophy className="h-4 w-4" />ELO 랭킹</Link></Button></div></div>

    {params.challenge_error && <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{CHALLENGE_ERRORS[params.challenge_error] ?? "대결 요청을 처리하지 못했습니다."}</div>}
    {params.challenge_requested && <div className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/5 p-3 text-sm text-success"><BellRing className="mt-0.5 h-4 w-4 shrink-0" />상대에게 대결 요청과 실시간 알림을 보냈습니다.</div>}
    {params.challenge_updated && <div className="rounded-xl border border-border bg-secondary p-3 text-sm">대결 요청 상태를 변경하고 상대에게 알림을 보냈습니다.</div>}
    {!challengeSchemaReady && <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>지정 대결 DB 업데이트가 필요합니다.</strong><p className="mt-1 text-xs opacity-80">`0026_direct_battle_challenges_admin_announcements.sql` 적용 전에는 기존 자동 매칭만 사용할 수 있습니다.</p></div></div>}

    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat icon={Shield} label="ELO" value={myRating} />
      <Stat icon={Swords} label="전적" value={`${rating?.wins ?? 0}승 ${rating?.losses ?? 0}패`} />
      <Stat icon={Crown} label="승률" value={`${winRate}%`} />
      <Stat icon={Trophy} label="Peak Rating" value={rating?.peak_rating ?? 1200} />
    </div>

    {challengeSchemaReady && <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><UserRoundPlus className="h-5 w-5 text-primary" />원하는 상대에게 대결 요청</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex gap-2" action="/battle/play">
          <div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input name="q" defaultValue={q} className="pl-9" placeholder="대결할 사용자 닉네임 검색" /></div>
          <Button type="submit" variant="outline">검색</Button>
        </form>
        {q && !searched.length && <p className="rounded-xl bg-secondary py-8 text-center text-sm text-muted-foreground">검색된 사용자가 없습니다.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {searched.map((target) => {
            const targetRating = ratingMap.get(target.id) ?? 1200;
            return <div key={target.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <Link href={`/users/${target.id}`} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-bold">
                  <Avatar src={target.avatar_url} size={40} fallback={target.nickname[0]} />
                </Link>
                <div className="min-w-0 flex-1"><RatingName nickname={target.nickname} rating={targetRating} userId={target.id} className="truncate" /><p className="text-xs text-muted-foreground">{target.grade_level || "학년 미설정"} · Rating {targetRating}</p></div>
              </div>
              <form action={requestDirectBattle} className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <input type="hidden" name="target_user_id" value={target.id} />
                <select name="subject_id" className="h-10 rounded-xl border border-input bg-background px-3 text-sm">{SUBJECTS.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}</select>
                <Button type="submit"><Swords className="h-4 w-4" />요청</Button>
              </form>
            </div>;
          })}
        </div>
      </CardContent>
    </Card>}

    {challengeSchemaReady && (incoming.length > 0 || outgoing.length > 0 || accepted.length > 0) && <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-5 w-5 text-primary" />대결 요청함</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {incoming.map((challenge) => {
          const challenger = userMap.get(challenge.challenger_id);
          const challengerRating = ratingMap.get(challenge.challenger_id) ?? 1200;
          return <ChallengeCard key={challenge.id} label="받은 요청" challenge={challenge} user={challenger} rating={challengerRating}>
            <form action={respondDirectBattle}><input type="hidden" name="challenge_id" value={challenge.id} /><input type="hidden" name="action" value="decline" /><Button type="submit" size="sm" variant="outline"><X className="h-4 w-4" />거절</Button></form>
            <form action={respondDirectBattle}><input type="hidden" name="challenge_id" value={challenge.id} /><input type="hidden" name="action" value="accept" /><Button type="submit" size="sm"><Check className="h-4 w-4" />수락하고 입장</Button></form>
          </ChallengeCard>;
        })}
        {outgoing.map((challenge) => {
          const target = userMap.get(challenge.target_id);
          return <ChallengeCard key={challenge.id} label="보낸 요청 · 응답 대기" challenge={challenge} user={target} rating={ratingMap.get(challenge.target_id) ?? 1200}>
            <form action={respondDirectBattle}><input type="hidden" name="challenge_id" value={challenge.id} /><input type="hidden" name="action" value="cancel" /><Button type="submit" size="sm" variant="outline">요청 취소</Button></form>
          </ChallengeCard>;
        })}
        {accepted.map((challenge) => {
          const opponentId = challenge.challenger_id === user.id ? challenge.target_id : challenge.challenger_id;
          return <ChallengeCard key={challenge.id} label="수락된 요청" challenge={challenge} user={userMap.get(opponentId)} rating={ratingMap.get(opponentId) ?? 1200}>
            <Button asChild size="sm"><Link href={`/battle/play?match=${challenge.match_id}`}><Swords className="h-4 w-4" />배틀 입장</Link></Button>
          </ChallengeCard>;
        })}
      </CardContent>
    </Card>}

    <BattleArena key={initialMatchId ?? "matchmaking"} gradeLevel={profile?.grade_level ?? "학년 미설정"} rating={myRating} initialMatchId={initialMatchId} />
  </div>;
}

function ChallengeCard({
  label,
  challenge,
  user,
  rating,
  children,
}: {
  label: string;
  challenge: ChallengeRow;
  user?: UserSummary;
  rating: number;
  children: React.ReactNode;
}) {
  const subject = SUBJECTS.find((item) => item.id === challenge.subject_id)?.label ?? challenge.subject_id;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
    <div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{label}</Badge><RatingName nickname={user?.nickname ?? "사용자"} rating={rating} userId={user?.id} /></div>
      <p className="mt-1 text-xs text-muted-foreground">{challenge.grade_level} · {subject} · {challenge.status === "pending" ? `${new Date(challenge.expires_at).toLocaleString("ko-KR")}까지` : "수락 완료"}</p>
    </div>
    <div className="flex gap-2">{children}</div>
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><Icon className="mb-2 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold sm:text-xl">{value}</p></CardContent></Card>;
}
