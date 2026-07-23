import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Crown,
  Database,
  FileQuestion,
  KeyRound,
  LockKeyhole,
  Megaphone,
  MessageSquareWarning,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  Siren,
  Swords,
  UsersRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { getDeveloperSchemaStatus } from "@/lib/developer/schema-status";
import { DEVELOPER_AUDIT_CATALOG } from "@/lib/developer/audit-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Developer Console Operations Manual" };

const SCREEN_GUIDE = [
  { screen: "Overview", href: "/developer", data: "사용자·문제·대회·배틀 수, DB 기능 상태, 최근 감사 로그, 콘솔 테마", purpose: "서비스 상태 파악, 점검 모드 제어, Dark·Light·System 화면 선택", impact: "Maintenance 활성화 시 일반 사용자 화면을 점검 페이지로 전환. 테마 선택은 현재 브라우저에 저장", recovery: "같은 화면에서 Maintenance 해제, 상단 선택기에서 System으로 복원" },
  { screen: "Questions", href: "/developer/questions", data: "학년, 과목, 단원, 난이도, 보기, 정답, 해설, 공개 상태", purpose: "문제 출제·검수·공개·보관", impact: "Published 문제는 연습과 대회 구성에 사용 가능", recovery: "Archived 또는 Draft로 전환" },
  { screen: "Contests", href: "/developer/contests", data: "대회명, 대상 학년·과목, 문제, 시작·종료 시각, Rated 여부", purpose: "대회 생성·공개·종료·Rating 정산", impact: "Rated 종료는 참가자의 Rating과 순위를 변경", recovery: "종료 전에는 상태 변경 가능, 정산 후에는 수동 보정 및 감사 기록 필요" },
  { screen: "Users", href: "/developer/users", data: "프로필, User·Admin·Super Admin 역할, 플랜, 현재·최고 Rating", purpose: "사용자 권한·플랜·Rating 관리", impact: "Admin은 콘솔 운영 권한, Super Admin은 역할·감사 로그까지 관리하는 최고 권한을 부여", recovery: "Super Admin이 근거와 사유를 남기고 원래 역할·값으로 재설정" },
  { screen: "Rating Events", href: "/developer/ratings", data: "전체 사용자의 Rating 전후값, 변화량, 사유, 원본 배틀·대회, Codeforces 보정값", purpose: "Rating 정산 이력 조회와 잘못된 단일 이벤트 삭제·후속 History 재계산", impact: "삭제 즉시 대상 사용자의 현재·최고 Rating, rated 횟수, 순위, Dashboard 그래프와 상세 History가 변경", recovery: "감사 로그의 deletedEvent 전체 스냅샷을 근거로 Rating 수동 정정. 가입 시작점은 삭제 불가" },
  { screen: "Announcements", href: "/developer/notifications", data: "제목, 본문, 전체·학년·개별 수신 범위", purpose: "실시간 서비스 공지 발송", impact: "선택된 모든 사용자 알림함에 즉시 생성", recovery: "이미 발송된 알림은 일괄 회수되지 않으므로 정정 공지 발송" },
  { screen: "Forum", href: "/developer/forum", data: "게시글 원문, 작성자, 조회·댓글·좋아요, 중요 공지·고정 상태", purpose: "관리자 중요 공지 게시와 일반 게시글 운영", impact: "관리자 작성 글은 중요 공지로 자동 고정되고 전체 사용자 알림 발송. 삭제 시 연결 댓글·좋아요도 삭제", recovery: "관리자 중요 공지는 고정 해제 불가. 내용 오류 시 삭제 후 정정 공지 게시" },
  { screen: "Chat Reports", href: "/developer/reports", data: "신고 메시지 스냅샷, 신고 사유, 신고자·대상, 처리 상태", purpose: "채팅 신고 검토와 경고·기간/영구 제한", impact: "제한 사용자는 모든 1:1 메시지 전송이 차단", recovery: "현재 제한 사용자에서 해제 사유를 입력해 즉시 해제" },
  { screen: "Audit Log", href: "/developer/audit", data: "실행자, 작업명, 대상, 세부값, 시각, 접속 문맥, 편집·보관 상태와 개정 이력", purpose: "운영 변경 추적과 사고 조사. Super Admin은 오류 로그를 수정·보관·복원", impact: "모든 편집은 변경 전·후 원본 스냅샷과 별도 audit.update/archive/restore 이벤트를 생성", recovery: "개정 이력의 이전 스냅샷을 근거로 재수정하거나 보관 로그를 복원" },
];

const FEATURE_MANUALS: Array<{
  id: string;
  title: string;
  icon: React.ElementType;
  href: string;
  useWhen: string;
  before: string[];
  procedure: string[];
  verify: string[];
  avoid: string;
}> = [
  {
    id: "questions",
    title: "문제 출제와 공개",
    icon: FileQuestion,
    href: "/developer/questions",
    useWhen: "새 학년별 문제를 만들거나 오답·해설을 수정할 때",
    before: ["대상 학년·과목·단원이 교육과정과 일치하는지 확인", "보기 사이에 중복이 없고 정답이 보기 중 하나인지 확인", "해설이 정답을 논리적으로 설명하며 다른 답의 오해 가능성을 줄이는지 확인"],
    procedure: ["Draft 상태로 문제와 보기를 입력", "난이도 1~5를 실제 풀이 단계 수에 맞춰 지정", "미리보기처럼 문제·정답·해설을 다시 읽고 저장", "검수가 끝난 문제만 Published로 전환", "사용하지 않을 문제는 삭제 대신 Archived로 보관"],
    verify: ["Questions 목록에서 학년·과목·상태가 맞는지 확인", "실제 연습 문제 해석 경로에서 정답이 노출되지 않는지 확인", "Audit Log의 question.create/update/published 기록 확인"],
    avoid: "정답이나 해설이 불완전한 상태에서 바로 Published로 저장하지 마세요.",
  },
  {
    id: "contests",
    title: "대회 생성과 종료",
    icon: Swords,
    href: "/developer/contests",
    useWhen: "정기 대회·특별 대회·학년별 평가전을 개최할 때",
    before: ["시작 시각의 시간대가 Asia/Seoul 기준인지 확인", "Published 문제만 선택했는지 확인", "Rated 여부와 대상 학년을 두 명 이상이 교차 확인", "문제 수와 제한 시간이 난이도에 적절한지 확인"],
    procedure: ["대회명에는 회차와 대상이 드러나도록 작성", "설명에 참가 조건·채점·동점 규칙을 안내", "문제와 진행 시간을 설정하고 우선 Draft 저장", "공지 발송 전 대회를 Published로 전환", "대회 종료 후 참가 현황을 확인하고 Finish로 Rating 정산"],
    verify: ["일반 사용자 대회 목록에 노출되는지 확인", "시작 전 문제 풀이가 불가능한지 확인", "종료 후 리더보드·Rating History·알림 확인", "contest.finish 감사 로그와 참가자 수 확인"],
    avoid: "Rated 설정을 잘못한 대회를 종료하면 전체 참가자 Rating에 영향을 주므로 종료 버튼을 급하게 누르지 마세요.",
  },
  {
    id: "users",
    title: "사용자·권한·Rating 조정",
    icon: UsersRound,
    href: "/developer/users",
    useWhen: "플랜 반영, 운영자 지정, 명백한 Rating 정산 오류를 교정할 때",
    before: ["닉네임뿐 아니라 사용자 UUID와 공개 프로필을 함께 확인", "현재 값과 변경 예정 값을 별도로 기록", "Rating은 대회·배틀 원기록과 알림을 먼저 검토", "Admin·Super Admin 부여는 최고 운영자 승인과 최소 권한 원칙 확인"],
    procedure: ["대상 사용자를 검색하고 프로필 링크로 본인 확인", "일반 관리자는 플랜만, Super Admin은 User·Admin·Super Admin 역할까지 변경", "역할 변경 사유에는 승인 근거, 변경 전후 역할, 적용 목적을 포함", "Rating 변경은 역할·플랜 변경과 분리해 구체적 정산 사유 입력", "저장 후 대상 사용자 알림과 권한 적용을 확인"],
    verify: ["Users 목록과 공개 프로필의 값이 일치하는지 확인", "역할 변경 대상에게 운영 권한 변경 알림이 도착했는지 확인", "Admin의 콘솔 접근 및 Super Admin 전용 편집 노출 여부 확인", "Rating 그래프에 Admin Rating Adjustment와 사유가 표시되는지 확인", "Audit Log에서 user.role.update, user.update 또는 rating.adjust 확인"],
    avoid: "현재 Super Admin 계정을 스스로 강등하거나 마지막 Super Admin을 제거할 수 없습니다. 순위 상승 요청이나 주관적 판단만으로 Rating을 수동 조정하지 마세요.",
  },
  {
    id: "rating-events",
    title: "Rating 이벤트 조회·삭제·재계산",
    icon: Activity,
    href: "/developer/ratings",
    useWhen: "중복 정산, 잘못 연결된 경기처럼 특정 Rating 이벤트 자체를 무효화해야 할 때",
    before: ["사용자 UUID와 닉네임을 모두 확인", "History ID와 Origin Event ID가 조사 대상과 일치하는지 확인", "배틀 점수 또는 대회 순위와 Rating 사유·보정값 비교", "현재 Rating과 삭제 후 예상 Rating을 별도로 기록", "단순 목표값 교정이면 삭제 대신 Users의 Rating 수동 조정을 우선 검토"],
    procedure: ["닉네임·UUID 및 이벤트 유형으로 대상 기록 검색", "이벤트명·날짜·전후 Rating·사유·원본 ID·보정값 확인", "삭제 근거에 오류 원인과 원본 이벤트를 구체적으로 작성", "확인창에서 사용자와 이벤트명을 다시 확인한 뒤 삭제", "시스템이 남은 History를 시간순으로 연결하고 현재·최고 Rating과 rated 횟수를 재계산하도록 완료까지 대기"],
    verify: ["Rating Events 목록에서 삭제된 History ID가 사라졌는지 확인", "대상 사용자 Dashboard와 Rating 상세 History의 그래프·전후값 확인", "공개 프로필·전체 랭킹의 현재 Rating 확인", "대상 사용자에게 삭제·재계산 사유 알림이 도착했는지 확인", "Audit Log의 rating.history.delete에서 deletedEvent 전체 스냅샷과 재계산 결과 확인"],
    avoid: "가입 시작점은 삭제할 수 없습니다. 근거가 불충분한 이벤트를 삭제하거나 감사 로그를 삭제해 작업을 감추지 마세요.",
  },
  {
    id: "announcements",
    title: "공지 작성과 발송",
    icon: Megaphone,
    href: "/developer/notifications",
    useWhen: "점검, 대회, 정책 변경, 장애 복구를 사용자에게 알릴 때",
    before: ["수신 범위가 전체·학년·개별 중 맞는지 확인", "제목만 읽어도 목적을 알 수 있는지 확인", "날짜·시간·시간대·영향 범위·문의 경로 포함", "오탈자와 내부 정보 노출 여부 확인"],
    procedure: ["제목은 결론부터 간결하게 작성", "본문에 발생/예정 시각, 영향, 사용자가 할 일을 순서대로 작성", "학년 또는 개별 대상이면 선택값 재확인", "발송 수를 마지막으로 확인하고 전송"],
    verify: ["성공 메시지의 수신자 수 확인", "테스트 계정의 실시간 알림 벨에서 제목·본문 확인", "notification.broadcast 감사 로그 확인"],
    avoid: "비밀번호, 키, 내부 URL, 신고자 정보 같은 민감 정보를 공지에 포함하지 마세요.",
  },
  {
    id: "forum",
    title: "포럼 운영",
    icon: MessageSquareWarning,
    href: "/developer/forum",
    useWhen: "공지를 상단 고정하거나 규칙 위반 게시글을 처리할 때",
    before: ["중요 공지라면 제목·본문·전체 알림 발송 범위를 게시 전에 교차 검수", "일반 게시글은 전체 글과 댓글 맥락 확인", "삭제 대신 안내 댓글로 해결 가능한지 판단", "동일 사용자의 반복 위반 여부는 Audit Log와 함께 확인"],
    procedure: ["관리자 공지는 관리자 공지 작성 버튼에서 게시하면 자동으로 공지 분류·상단 고정·전체 알림 처리", "일반 게시글은 필요할 때만 상단 고정", "삭제가 필요한 경우 사용자가 이해할 수 있는 구체적 사유 작성", "삭제 확인창에서 대상 제목 재확인", "반복 위반이면 별도 운영 기록을 남기고 정책에 따라 대응"],
    verify: ["중요 공지가 일반 글보다 위에 표시되는지 확인", "테스트 사용자에게 forum_announcement 실시간 알림이 전달됐는지 확인", "일반 고정 또는 삭제 결과 확인", "forum.announcement.create 또는 forum.pin/unpin/delete 감사 로그 확인"],
    avoid: "관리자 공지는 전체 알림이 즉시 발송되므로 초안이나 내부 정보를 게시하지 마세요. 의견이 다르다는 이유만으로 일반 글을 삭제하지 않습니다.",
  },
  {
    id: "chat-reports",
    title: "채팅 신고 처리",
    icon: ShieldCheck,
    href: "/developer/reports",
    useWhen: "괴롭힘, 스팸, 개인정보 노출, 위협 메시지 신고가 접수됐을 때",
    before: ["신고 메시지 스냅샷과 상세 사유를 모두 확인", "신고자·대상 사용자를 혼동하지 않았는지 확인", "즉각적 위험·개인정보 노출 여부를 우선 판단", "같은 대상의 이전 신고와 현재 제한 여부 확인"],
    procedure: ["Pending 신고를 검토 시작으로 전환", "증거가 부족하면 기각 사유를 구체적으로 기록", "위반이면 경고, 1·7·30일 또는 영구 제한 중 비례적 조치 선택", "처리 근거에 확인 사실과 정책 기준을 작성", "필요 시 현재 제한 사용자에서 조기 해제"],
    verify: ["신고 상태가 Resolved 또는 Dismissed인지 확인", "신고자에게 결과 알림, 대상에게 조치 사유 알림 확인", "제한 계정에서 메시지 전송이 차단되는지 확인", "chat.report.resolve 감사 로그 확인"],
    avoid: "신고자 신원을 신고 대상에게 전달하거나 신고 메시지를 운영 외 목적으로 복사하지 마세요.",
  },
];

const INCIDENTS = [
  { level: "P0", label: "전체 서비스 중단·데이터 훼손·계정 탈취", color: "border-red-900 bg-red-950/25 text-red-200", first: "즉시 Maintenance 활성화, 추가 변경 중지, 시각과 증상 기록", next: "환경 키 회전·DB 로그/감사 로그 보존·책임자 호출·복구 후 공지" },
  { level: "P1", label: "로그인·채점·Rating·대회 등 핵심 기능 장애", color: "border-amber-900 bg-amber-950/25 text-amber-200", first: "영향 범위 확인 후 필요하면 Maintenance 활성화", next: "최근 배포·마이그레이션·감사 로그 비교, 우회 경로 제공, 복구 공지" },
  { level: "P2", label: "일부 화면 오류·표시 문제·개별 사용자 문의", color: "border-sky-900 bg-sky-950/25 text-sky-200", first: "재현 조건, 사용자 UUID, 시각, 화면을 기록", next: "데이터 변경 없이 진단하고 수정 후 관련 화면만 검증" },
];

const REASON_EXAMPLES = [
  { action: "Rating 조정", bad: "점수 수정", good: "2026-07-23 중1 수학 정기대회 중복 정산 복구: 1482 → 1437 (-45)" },
  { action: "포럼 삭제", bad: "규칙 위반", good: "타인의 전화번호가 본문에 노출되어 개인정보 보호 정책에 따라 삭제" },
  { action: "채팅 제한", bad: "욕설함", good: "동일 사용자에게 모욕성 메시지를 반복 전송한 신고 3건 확인, 7일 채팅 제한" },
  { action: "제한 해제", bad: "풀어줌", good: "오탐 신고로 확인되어 2026-07-23 18:10 조기 해제" },
  { action: "점검 모드", bad: "서버 문제", good: "대회 Rating 중복 정산 원인 조사 및 추가 반영 방지를 위한 긴급 점검" },
];

const SCHEMA_LABELS: Record<string, string> = {
  questionMetadata: "문제 상태·학년 메타데이터",
  contestPublishing: "대회 공개 상태",
  auditLog: "관리자 감사 로그",
  ratingNotifications: "Rating 사유·알림",
  ratingAdjustmentRpc: "안전한 Rating 조정 함수",
  ratingEventDetails: "Rating 이벤트명·상대 보존",
  ratingHistoryManagement: "Rating 이력 삭제·재계산",
  directBattleChallenges: "지정 사용자 배틀 요청",
  adminForumAnnouncements: "관리자 중요 공지",
  chatSafety: "채팅 신고·제한",
  superAdminPermissions: "Super Admin·감사 로그 개정 이력",
};

export default async function DeveloperGuidePage() {
  const { admin, profile } = await requireDeveloper();
  const schema = await getDeveloperSchemaStatus(admin);
  const readyCount = Object.values(schema).filter(Boolean).length;
  const totalCount = Object.keys(schema).length;
  const allReady = readyCount === totalCount;

  return <div className="flex flex-col gap-8">
    <div>
      <div className="flex flex-wrap items-center gap-2"><h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpenCheck className="h-6 w-6 text-emerald-400" />Developer Operations Manual</h1><span className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400">관리자 운영 가이드</span></div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{profile.nickname} 관리자님을 위한 실제 운영 매뉴얼입니다. 처음 15분 준비부터 문제·대회·사용자·신고 처리, 장애 대응과 복구 확인까지 작업 순서대로 설명합니다.</p>
    </div>

    <Card className="border-emerald-900 bg-emerald-950/20 text-zinc-100">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex gap-3"><Wrench className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /><div><h2 className="font-semibold">점검 모드에서도 개발자 콘솔은 계속 열립니다.</h2><p className="mt-1 text-xs leading-5 text-zinc-400">`/developer`와 모든 하위 화면은 Maintenance 예외입니다. 다만 일반 접근이 허용되는 것은 아니며, Admin 역할과 특별 로그인 세션 검사는 그대로 적용됩니다. 점검 중 원인 조사·공지·복구·점검 해제를 이 콘솔에서 진행하세요.</p></div></div>
        <Button asChild variant="outline"><Link href="/developer">Overview로 이동<ArrowRight className="h-4 w-4" /></Link></Button>
      </CardContent>
    </Card>

    <nav className="sticky top-16 z-20 flex gap-2 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 text-xs backdrop-blur" aria-label="가이드 목차">
      {[
        ["start", "처음 15분"],
        ["permissions", "권한 체계"],
        ["screens", "화면 설명표"],
        ["manuals", "기능별 절차"],
        ["workflows", "핵심 업무 흐름"],
        ["reasons", "사유 작성법"],
        ["audit", "감사 로그"],
        ["incidents", "장애 대응"],
        ["database", "DB·복구"],
        ["routine", "정기 점검"],
      ].map(([id, label]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-900 hover:text-emerald-300">{label}</a>)}
    </nav>

    <section id="start" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={KeyRound} title="처음 접속한 뒤 15분 체크리스트" description="아래 순서로 계정과 운영 환경을 먼저 확인합니다." />
      <div className="grid gap-3 lg:grid-cols-3">
        <Step number="1" icon={KeyRound} title="계정·세션 확인" text="현재 닉네임과 Admin 또는 Super Admin 역할을 확인합니다. 개발자 특별 세션은 8시간 유지되며 공용 기기에서는 작업 직후 로그아웃합니다." />
        <Step number="2" icon={Database} title="DB 기능 상태 확인" text={`현재 ${totalCount}개 기능 중 ${readyCount}개가 준비되었습니다. 준비되지 않은 항목이 있으면 쓰기 작업보다 마이그레이션 상태를 먼저 확인합니다.`} />
        <Step number="3" icon={Activity} title="서비스 상태 확인" text="Overview의 사용자·문제·대회·배틀·미처리 신고 수가 비정상적으로 0이거나 급변했는지 확인합니다." />
        <Step number="4" icon={ScrollText} title="최근 변경 확인" text="Recent Audit Log에서 직전 관리자의 점검 모드, Rating, 대회 종료, 게시물 조치를 확인합니다." />
        <Step number="5" icon={ClipboardCheck} title="미처리 업무 확인" text="Chat Reports의 Pending, Forum의 신고 대상, 예정 대회와 Draft 문제를 우선순위대로 확인합니다." />
        <Step number="6" icon={ShieldCheck} title="작업 원칙 확인" text="대상 UUID, 변경 전후 값, 구체적 사유, 사용자 알림, 감사 로그까지 한 작업으로 처리합니다." />
      </div>
      <div className={`rounded-xl border p-4 ${allReady ? "border-emerald-900 bg-emerald-950/20" : "border-amber-900 bg-amber-950/20"}`}>
        <div className="flex items-center gap-2"><Database className={`h-4 w-4 ${allReady ? "text-emerald-400" : "text-amber-400"}`} /><strong className="text-sm">{allReady ? "모든 DB 기능 준비 완료" : `DB 기능 ${totalCount - readyCount}개 업데이트 필요`}</strong></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(schema).map(([key, ready]) => <div key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${ready ? "border-emerald-900/70 bg-emerald-950/20 text-emerald-300" : "border-amber-900/70 bg-amber-950/20 text-amber-300"}`}>{ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{SCHEMA_LABELS[key] ?? key}</div>)}</div>
      </div>
    </section>

    <section id="permissions" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={Crown} title="운영 권한 체계" description="권한은 User → Admin → Super Admin 순서이며, 높은 역할은 낮은 역할의 기능을 모두 포함합니다." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">User</CardTitle></CardHeader><CardContent className="text-xs leading-5 text-zinc-400">일반 학습자 역할입니다. 개발자 특별 로그인과 `/developer` 화면에 접근할 수 없습니다.</CardContent></Card>
        <Card className="border-emerald-900/70 bg-emerald-950/15 text-zinc-100"><CardHeader><CardTitle className="text-base text-emerald-300">Admin</CardTitle></CardHeader><CardContent className="text-xs leading-5 text-zinc-400">문제 출제·대회 운영·플랜·Rating·공지·포럼·채팅 신고·점검 모드를 관리하고 감사 로그를 조회합니다. 다른 사용자의 운영 역할이나 감사 로그 원문은 변경할 수 없습니다.</CardContent></Card>
        <Card className="border-violet-900 bg-violet-950/20 text-zinc-100"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-violet-300"><Crown className="h-4 w-4" />Super Admin</CardTitle></CardHeader><CardContent className="text-xs leading-5 text-zinc-400">Admin의 모든 기능에 더해 User·Admin·Super Admin 승격·강등, 감사 로그 수정·보관·복원과 개정 이력 열람 권한을 가집니다. 역할 변경과 로그 편집에는 구체적인 사유가 필수입니다.</CardContent></Card>
      </div>
      <Card className="border-amber-900 bg-amber-950/20 text-amber-100"><CardHeader><CardTitle className="text-base">최고 운영자 안전 규칙</CardTitle></CardHeader><CardContent><Checklist title="반드시 지킬 사항" numbered tone="amber" items={["Super Admin은 꼭 필요한 최소 인원에게만 부여합니다.", "현재 로그인한 Super Admin은 자기 자신을 강등할 수 없고 마지막 Super Admin도 제거할 수 없습니다.", "역할 변경 시 승인자·업무 목적·변경 전후 역할을 사유에 기록합니다.", "감사 로그를 수정해도 원본은 개정 이력에서 삭제되지 않으며 수정 작업 자체가 새 감사 이벤트로 남습니다.", "노출에서 제외할 로그는 영구 삭제하지 않고 보관하며, 복원이 필요한 경우 다시 사유를 남깁니다.", "권한 오부여가 의심되면 해당 계정 역할과 최근 developer.login·user.role.update 기록을 먼저 확인합니다."]} /></CardContent></Card>
    </section>

    <section id="screens" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={BookOpenCheck} title="화면별 기능·영향·복구 설명표" description="각 화면이 다루는 데이터와 변경 후 영향, 되돌리는 방법을 함께 확인하세요." />
      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1180px] text-left text-xs">
            <thead><tr className="border-b border-zinc-800 text-zinc-500"><th className="px-4 py-3">화면</th><th className="px-4 py-3">다루는 데이터</th><th className="px-4 py-3">주요 목적</th><th className="px-4 py-3">변경 영향</th><th className="px-4 py-3">복구·정정</th><th className="px-4 py-3">이동</th></tr></thead>
            <tbody>{SCREEN_GUIDE.map((item) => <tr key={item.screen} className="border-b border-zinc-800/70 align-top last:border-0"><td className="whitespace-nowrap px-4 py-4 font-semibold text-emerald-300">{item.screen}</td><td className="max-w-64 px-4 py-4 leading-5 text-zinc-400">{item.data}</td><td className="max-w-52 px-4 py-4 leading-5 text-zinc-300">{item.purpose}</td><td className="max-w-64 px-4 py-4 leading-5 text-amber-200/75">{item.impact}</td><td className="max-w-64 px-4 py-4 leading-5 text-zinc-400">{item.recovery}</td><td className="px-4 py-4"><Button asChild size="sm" variant="outline"><Link href={item.href}>열기<ArrowRight className="h-3.5 w-3.5" /></Link></Button></td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
    </section>

    <section id="manuals" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={ClipboardCheck} title="기능별 상세 작업 절차" description="각 항목을 펼치면 작업 전 확인, 실행 순서, 완료 검증과 금지사항을 볼 수 있습니다." />
      <div className="grid gap-3">
        {FEATURE_MANUALS.map((manual) => <details key={manual.id} className="group rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950"><manual.icon className="h-4 w-4 text-emerald-400" /></span><div><h3 className="font-semibold">{manual.title}</h3><p className="mt-1 text-xs text-zinc-500">{manual.useWhen}</p></div></div><span className="text-xs text-zinc-500 group-open:hidden">펼치기</span><span className="hidden text-xs text-emerald-400 group-open:inline">접기</span></summary>
          <div className="grid gap-4 border-t border-zinc-800 p-5 lg:grid-cols-3">
            <Checklist title="작업 전" items={manual.before} tone="amber" />
            <Checklist title="실행 순서" items={manual.procedure} tone="default" numbered />
            <Checklist title="완료 검증" items={manual.verify} tone="emerald" />
            <div className="rounded-xl border border-red-900/70 bg-red-950/20 p-4 text-xs leading-5 text-red-200 lg:col-span-3"><strong>하지 말아야 할 작업</strong><p className="mt-1 text-red-200/70">{manual.avoid}</p></div>
            <div className="lg:col-span-3"><Button asChild size="sm" variant="outline"><Link href={manual.href}>{manual.title} 화면 열기<ArrowRight className="h-3.5 w-3.5" /></Link></Button></div>
          </div>
        </details>)}
      </div>
    </section>

    <section id="workflows" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={RefreshCcw} title="핵심 업무 흐름" description="여러 화면을 오가는 작업은 아래 순서를 유지해야 누락을 줄일 수 있습니다." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Workflow title="새 정기 대회 개최" icon={Swords} steps={["Questions: 필요한 학년·과목 문제를 Draft로 출제", "Questions: 정답·해설 검수 후 Published 전환", "Contests: 회차·대상·시간·Rated 여부 설정 후 Draft 생성", "일반 사용자 관점에서 일정과 참가 조건 확인", "Contests: Published 전환 후 Announcements로 대상 학년 공지", "대회 진행 중 오류와 참가 현황 관찰", "종료 후 Finish 실행, 리더보드·Rating History·알림 검증", "Audit Log에서 출제·공개·종료 기록 확인"]} />
        <Workflow title="Rating 정산 오류 교정" icon={Activity} steps={["사용자 UUID와 문제가 된 배틀/대회 이벤트 확인", "Rating Events에서 변경 전후·사유·일시·원본 ID 확인", "대회 리더보드 또는 배틀 점수와 정산값 비교", "이벤트 자체가 무효면 Rating Events에서 근거를 작성해 삭제·재계산", "이벤트는 유효하고 목표값만 틀렸다면 Users에서 목표 Rating 수동 조정", "사용자 알림과 Dashboard 그래프·상세 History 확인", "전체 순위와 프로필 Rating 반영 확인", "Audit Log에서 rating.history.delete 또는 rating.adjust 세부값 보존 확인"]} />
        <Workflow title="채팅 신고 처리" icon={ShieldCheck} steps={["Chat Reports에서 Pending 선택", "메시지 원문·신고 유형·상세 사유·사용자 확인", "즉각적 위험이면 우선 검토 시작 후 필요한 보호 조치 적용", "증거와 반복성을 기준으로 기각·경고·기간/영구 제한 결정", "판단 근거와 사용자가 이해할 수 있는 사유 작성", "신고자 결과 알림과 대상 조치 알림 확인", "제한 사용자의 전송 차단 여부 확인", "Audit Log에서 review_start와 resolve 확인"]} />
        <Workflow title="긴급 점검과 복구" icon={Wrench} steps={["증상·최초 발생 시각·영향 범위 기록", "추가 데이터 손상 가능성이 있으면 Overview에서 Maintenance 활성화", "개발자 콘솔은 점검 중에도 계속 사용 가능", "최근 Audit Log, 배포, DB 마이그레이션 순서 확인", "원인 수정 후 관리자·테스트 계정으로 핵심 기능 검증", "Announcements로 복구 시각과 영향 공지", "Maintenance 해제 후 일반 계정 접근 확인", "장애 원인·조치·재발 방지 내용을 감사/운영 기록에 남김"]} />
      </div>
    </section>

    <section id="reasons" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={ScrollText} title="좋은 사유 작성법" description="사유는 사용자 알림, Rating History, 신고 결과와 Audit Log에 남을 수 있습니다." />
      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardContent className="p-5">
        <p className="text-sm text-zinc-300">좋은 사유는 <strong className="text-emerald-300">무엇이 발생했고 → 어떤 근거를 확인했으며 → 무엇을 어떻게 변경했는지</strong>를 한 문장만 읽어도 알 수 있어야 합니다. 비밀번호·토큰·신고자 신원 같은 민감 정보는 절대 포함하지 않습니다.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-zinc-800 text-zinc-500"><th className="px-3 py-3">작업</th><th className="px-3 py-3">나쁜 예</th><th className="px-3 py-3">권장 예</th></tr></thead><tbody>{REASON_EXAMPLES.map((row) => <tr key={row.action} className="border-b border-zinc-800/70 last:border-0"><td className="px-3 py-4 font-semibold text-zinc-300">{row.action}</td><td className="px-3 py-4 text-red-300/70">{row.bad}</td><td className="px-3 py-4 text-emerald-300/80">{row.good}</td></tr>)}</tbody></table></div>
      </CardContent></Card>
    </section>

    <section id="audit" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={ScrollText} title="감사 로그 작업 코드 상세 설명" description="Audit Log 필터에 보이는 각 작업이 언제 기록되고 어떤 값을 확인해야 하는지 설명합니다." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["actor_id", "실행자", "작업을 실행한 관리자 UUID입니다. 화면에서는 가능한 경우 닉네임으로 함께 표시됩니다."],
          ["action", "작업 코드", "developer.login, rating.adjust처럼 작업 종류를 변하지 않는 영문 코드로 기록합니다."],
          ["target_type / target_id", "대상", "user·question·contest·forum_post·message_report 등 대상 유형과 UUID입니다."],
          ["details", "세부 데이터", "사유, 변경 결과, 수신자 수, 제한 기간 등 작업별 핵심 값을 JSON으로 기록합니다."],
          ["details.request", "접속 문맥", "요청 IP와 User-Agent를 기록해 동일 계정의 접속 기기와 요청 출처를 조사할 수 있습니다."],
          ["created_at", "실행 시각", "DB에 저장된 정확한 시각이며 화면에서 한국 시간 형식으로 변환해 표시합니다."],
          ["edited_at / edited_by", "편집 정보", "Super Admin이 로그를 마지막으로 수정한 시각과 운영자 UUID입니다."],
          ["archived_at / archived_by", "보관 정보", "활성 목록에서 보관된 시각과 운영자 UUID입니다. 보관 로그 필터에서 계속 조회할 수 있습니다."],
          ["revisions", "개정 이력", "수정·보관·복원마다 사유와 변경 전·후 전체 JSON 스냅샷을 append-only 방식으로 보존합니다."],
        ].map(([field, label, text]) => <Card key={field} className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardContent className="p-4"><p className="font-mono text-xs text-emerald-300">{field}</p><h3 className="mt-2 text-sm font-semibold">{label}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p></CardContent></Card>)}
      </div>

      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader><CardTitle className="text-base">작업 코드별 기록·검증·복구 표</CardTitle><p className="text-xs text-zinc-500">작업 코드는 Audit Log 필터와 동일하며, 세부 데이터의 `request`는 모든 작업에 자동으로 추가됩니다.</p></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1500px] text-left text-xs">
            <thead><tr className="border-b border-zinc-800 text-zinc-500"><th className="px-4 py-3">작업 코드</th><th className="px-4 py-3">의미·기록 시점</th><th className="px-4 py-3">대상</th><th className="px-4 py-3">details 필드</th><th className="px-4 py-3">완료 검증</th><th className="px-4 py-3">오류 시 복구</th></tr></thead>
            <tbody>{DEVELOPER_AUDIT_CATALOG.map((entry) => <tr key={entry.action} className="border-b border-zinc-800/70 align-top last:border-0"><td className="whitespace-nowrap px-4 py-4"><code className="text-emerald-300">{entry.action}</code><p className="mt-1 font-sans text-zinc-500">{entry.label}</p></td><td className="max-w-72 px-4 py-4 leading-5 text-zinc-300">{entry.recordedWhen}</td><td className="max-w-48 px-4 py-4 font-mono leading-5 text-zinc-400">{entry.target}</td><td className="max-w-72 px-4 py-4 font-mono leading-5 text-amber-200/75">{entry.detailFields}</td><td className="max-w-72 px-4 py-4 leading-5 text-zinc-400">{entry.verify}</td><td className="max-w-80 px-4 py-4 leading-5 text-red-200/65">{entry.recovery}</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">감사 로그 조사 순서</CardTitle></CardHeader><CardContent><Checklist title="이상 작업 조사" numbered tone="default" items={["문제가 발생한 정확한 시간 범위를 먼저 정합니다.", "action 필터로 Rating·대회·권한 등 관련 작업만 좁힙니다.", "target 유형 또는 UUID로 동일 대상의 전후 로그를 찾습니다.", "실행자 닉네임과 actor_id, request.ip, User-Agent를 비교합니다.", "Edited 또는 Archived 표시가 있으면 개정 이력의 사유와 변경 전·후 스냅샷을 확인합니다.", "details의 사유·결과값과 실제 DB·사용자 화면을 대조합니다.", "복구가 필요하면 Super Admin이 원본 스냅샷을 근거로 재수정·복원하고 새 사유를 남깁니다.", "정정 후 새 Audit Log와 사용자 알림까지 확인합니다."]} /></CardContent></Card>
        <Card className="border-amber-900 bg-amber-950/20 text-amber-100"><CardHeader><CardTitle className="text-base">감사 로그 해석 시 주의사항</CardTitle></CardHeader><CardContent className="space-y-3 text-xs leading-5 text-amber-100/70"><p>로그가 존재한다는 사실만으로 작업 결과가 현재도 유지된다고 단정할 수 없습니다. 이후의 정정 로그를 함께 확인하세요.</p><p>`target_id`가 없는 공지·점검 작업은 details의 수신 범위와 enabled 값을 확인합니다.</p><p>일부 이전 버전 로그는 현재보다 세부 필드가 적을 수 있습니다. 해당 시점의 스키마 버전과 함께 해석하세요.</p><p>감사 로그에는 비밀번호와 인증 토큰을 저장하지 않습니다. 발견될 경우 보안 사고로 분류하고 즉시 키 교체를 검토하세요.</p><p>Super Admin 편집은 사실관계 오류 정정과 안전한 보관에만 사용합니다. 원본 스냅샷과 편집 작업 로그는 그대로 남으므로 변경 사유까지 함께 조사하세요.</p><Button asChild variant="outline" size="sm"><Link href="/developer/audit">Audit Log 열기<ArrowRight className="h-3.5 w-3.5" /></Link></Button></CardContent></Card>
      </div>
    </section>

    <section id="incidents" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={Siren} title="장애·보안 사고 대응" description="심각도를 먼저 분류하고, 수정 전에 증거와 현재 상태를 보존합니다." />
      <div className="grid gap-3">{INCIDENTS.map((incident) => <div key={incident.level} className={`grid gap-3 rounded-xl border p-4 lg:grid-cols-[80px_1fr_1fr] ${incident.color}`}><div><strong className="text-lg">{incident.level}</strong><p className="mt-1 text-[10px] opacity-70">심각도</p></div><div><p className="text-xs font-semibold">판단 기준</p><p className="mt-1 text-xs leading-5 opacity-80">{incident.label}</p><p className="mt-3 text-xs font-semibold">최초 조치</p><p className="mt-1 text-xs leading-5 opacity-80">{incident.first}</p></div><div><p className="text-xs font-semibold">후속 조치</p><p className="mt-1 text-xs leading-5 opacity-80">{incident.next}</p></div></div>)}</div>
      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">점검 모드 사용 기준</CardTitle></CardHeader><CardContent className="grid gap-4 text-xs leading-5 lg:grid-cols-3"><Rule title="켜야 하는 경우" items={["데이터 손상이 계속될 가능성", "로그인·채점·정산 등 핵심 흐름 오류", "민감 정보가 노출될 가능성", "복구 중 사용자 쓰기를 중지해야 하는 상황"]} /><Rule title="켜지 않아도 되는 경우" items={["일부 문구·정렬·색상 문제", "한 사용자에게만 발생하며 확산되지 않는 문제", "읽기 전용 진단으로 해결 가능한 문제", "핵심 흐름에 영향 없는 경미한 표시 오류"]} /><Rule title="해제 조건" items={["원인 수정 완료", "관리자와 일반 테스트 계정 검증", "DB 쓰기·알림·Realtime 정상 확인", "사용자 공지 준비 및 담당자 승인"]} /></CardContent></Card>
    </section>

    <section id="database" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={Database} title="DB 마이그레이션·복구·오류 대응" description="새 마이그레이션은 파일 번호 순서대로 적용하고 각 단계의 기능 상태를 확인합니다." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">마이그레이션 적용 절차</CardTitle></CardHeader><CardContent><Checklist title="Supabase SQL Editor" numbered tone="default" items={["운영 DB와 프로젝트 이름을 확인", "아직 적용되지 않은 가장 낮은 번호부터 SQL 파일을 하나씩 실행", "오류가 발생하면 다음 파일을 실행하지 않고 오류 전문과 번호 기록", "완료 후 Overview와 이 화면의 DB 기능 배지를 새로고침", "관련 화면에서 읽기와 테스트 데이터 쓰기를 각각 한 번 검증", "Audit Log 및 사용자 알림이 예상대로 생성되는지 확인"]} /><p className="mt-4 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-500">현재 개발자 콘솔 전체 기능은 `0021` → `0022` → `0023` → `0024` → `0025` → `0026` → `0027` 순서가 필요합니다. `0027` 적용 시 Super Admin이 없으면 가장 오래된 Admin 한 명이 최초 Super Admin으로 자동 승격됩니다.</p></CardContent></Card>
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">자주 발생하는 오류</CardTitle></CardHeader><CardContent className="space-y-3">{[
          ["Could not find function ... schema cache", "해당 RPC 마이그레이션 적용 여부를 확인하고 SQL의 `notify pgrst, 'reload schema'`까지 실행됐는지 확인합니다."],
          ["column/table does not exist", "마이그레이션 번호가 건너뛰어졌는지 확인합니다. 이전 번호부터 순서대로 적용합니다."],
          ["Realtime이 즉시 반영되지 않음", "브라우저 연결 상태, Supabase publication 등록, RLS SELECT 권한을 순서대로 확인합니다."],
          ["Rating 또는 대회 중복 정산 의심", "추가 Finish/수동 조정을 멈추고 contest_rating_changes, Rating History, Audit Log를 비교합니다."],
          ["관리자 작업은 성공했으나 감사 로그 없음", "`0021_developer_console.sql` 적용과 service role 환경 변수를 확인합니다."],
        ].map(([error, response]) => <div key={error} className="rounded-xl bg-zinc-950 p-3"><p className="font-mono text-xs text-amber-300">{error}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{response}</p></div>)}</CardContent></Card>
      </div>
      <Card className="border-red-900 bg-red-950/20 text-red-100"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4" />데이터 복구 안전 규칙</CardTitle></CardHeader><CardContent className="grid gap-3 text-xs leading-5 text-red-100/75 sm:grid-cols-2"><p>운영 DB에서 원인을 모르는 대량 UPDATE·DELETE를 실행하지 않습니다.</p><p>수정 전 대상 행 수, 사용자 UUID, 시간 범위를 SELECT로 먼저 확인합니다.</p><p>Rating처럼 파생 데이터는 원본 이벤트와 정산 기록을 먼저 보존합니다.</p><p>복구 작업도 누가·언제·왜·무엇을 변경했는지 별도 감사 기록을 남깁니다.</p><p>백업 복원은 현재 데이터 손실 범위를 계산하고 책임자 승인 후 진행합니다.</p><p>환경 키와 service role 값은 화면, 로그, 공지, 포럼에 절대 붙여넣지 않습니다.</p></CardContent></Card>
    </section>

    <section id="routine" className="scroll-mt-32 space-y-4">
      <SectionTitle icon={Clock3} title="일간·주간·월간 운영 체크리스트" description="문제가 생긴 뒤가 아니라 정기적으로 확인해야 하는 항목입니다." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Routine title="매일" items={["Overview DB·서비스 상태", "Pending Chat Reports", "예정·진행 중 대회", "최근 Audit Log 이상 작업", "사용자 문의·포럼 중요 게시물"]} />
        <Routine title="매주" items={["Draft/Archived 문제 품질 검수", "대회 Rating 정산 표본 확인", "장기 미처리 신고·공지 정리", "관리자 계정과 역할 검토", "반복 오류와 운영 사유 패턴 정리"]} />
        <Routine title="매월" items={["Supabase 백업·복구 가능성 확인", "환경 키와 접근 권한 검토", "감사 로그 보존·검색 확인", "문제은행 학년·과목 커버리지 확인", "운영 정책·가이드 최신화"]} />
      </div>
    </section>

    <Card className="border-amber-900 bg-amber-950/25 text-amber-100"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />최종 운영 원칙</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-amber-100/75 md:grid-cols-2"><p>사용자 신고 내용과 메시지는 운영 목적 외에 공유하지 않습니다.</p><p>계정·Rating·채팅 제한은 증거와 사유를 확인한 뒤 필요한 범위에서만 적용합니다.</p><p>대량 공지, 게시글 삭제, 대회 종료처럼 되돌리기 어려운 작업은 대상과 결과를 다시 확인합니다.</p><p>이상 동작이 발견되면 추가 변경보다 Audit Log와 DB 상태를 먼저 보존합니다.</p><p>사용자에게 표시되는 사유는 구체적이고 존중하는 표현으로 작성합니다.</p><p>작업 완료의 기준은 버튼 성공이 아니라 데이터·알림·화면·감사 로그 검증까지입니다.</p></CardContent></Card>
  </div>;
}

function SectionTitle({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return <div><h2 className="flex items-center gap-2 text-lg font-bold"><Icon className="h-5 w-5 text-emerald-400" />{title}</h2><p className="mt-1 text-sm text-zinc-500">{description}</p></div>;
}

function Step({ number, icon: Icon, title, text }: { number: string; icon: React.ElementType; title: string; text: string }) {
  return <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardContent className="p-5"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-emerald-400" /><span className="text-xs font-bold text-zinc-600">STEP {number}</span></div><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-zinc-400">{text}</p></CardContent></Card>;
}

function Checklist({ title, items, numbered = false, tone }: { title: string; items: string[]; numbered?: boolean; tone: "default" | "amber" | "emerald" }) {
  const color = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-zinc-200";
  return <div><h4 className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</h4><ol className="mt-3 space-y-2">{items.map((item, index) => <li key={item} className="flex gap-2 text-xs leading-5 text-zinc-400"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[10px] ${color}`}>{numbered ? index + 1 : <CheckCircle2 className="h-3 w-3" />}</span><span>{item}</span></li>)}</ol></div>;
}

function Workflow({ title, icon: Icon, steps }: { title: string; icon: React.ElementType; steps: string[] }) {
  return <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-emerald-400" />{title}</CardTitle></CardHeader><CardContent><ol className="space-y-2">{steps.map((step, index) => <li key={step} className="flex gap-3 text-xs leading-5 text-zinc-400"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-950 font-mono text-[10px] text-emerald-300">{index + 1}</span><span>{step}</span></li>)}</ol></CardContent></Card>;
}

function Rule({ title, items }: { title: string; items: string[] }) {
  return <div><h3 className="font-semibold text-zinc-200">{title}</h3><ul className="mt-2 space-y-2 text-zinc-400">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />{item}</li>)}</ul></div>;
}

function Routine({ title, items }: { title: string; items: string[] }) {
  return <Card className="border-zinc-800 bg-zinc-900 text-zinc-100"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent><ul className="space-y-2">{items.map((item) => <li key={item} className="flex items-center gap-2 text-xs text-zinc-400"><span className="h-3.5 w-3.5 rounded border border-zinc-700" />{item}</li>)}</ul></CardContent></Card>;
}
