import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, Heart, MessageCircle, MessagesSquare, Pin, PinOff, Search } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { deleteDeveloperForumPost, setDeveloperForumPin } from "../../actions";
import { ConfirmSubmitButton } from "@/components/developer/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Developer Forum Moderation" };
const CATEGORIES = ["전체", "자유", "질문", "공부팁", "대회", "공지"];

export default async function DeveloperForumPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; error?: string; updated?: string }>;
}) {
  const { admin } = await requireDeveloper();
  const params = await searchParams;
  const q = (params.q ?? "").trim().replace(/[,%()]/g, "").slice(0, 80);
  const category = CATEGORIES.includes(params.category ?? "") ? params.category! : "전체";
  let query = admin.from("forum_posts")
    .select("id,user_id,category,title,content,pinned,views,created_at,forum_comments(count),forum_likes(count)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (category !== "전체") query = query.eq("category", category);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: posts, error: queryError } = await query;
  const authorIds = [...new Set((posts ?? []).map((post) => post.user_id))];
  const { data: authors } = authorIds.length
    ? await admin.from("profiles").select("id,nickname").in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authors ?? []).map((author) => [author.id, author.nickname]));

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><MessagesSquare className="h-6 w-6 text-emerald-400" />Forum Moderation</h1><p className="mt-1 text-sm text-zinc-400">게시글 검색, 공지 고정, 사유 기반 삭제와 사용자 알림을 관리합니다.</p></div><Button asChild variant="outline"><Link href="/forum/new">관리자 공지 작성<ExternalLink className="h-4 w-4" /></Link></Button></div>
    {params.error && <div className="flex gap-2 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" />{params.error === "invalid_moderation_reason" ? "삭제 사유를 3~300자로 입력해주세요." : params.error === "protected_announcement" ? "관리자가 작성한 중요 공지는 항상 상단 고정되므로 고정을 해제할 수 없습니다." : "포럼 관리 작업을 완료하지 못했습니다."}</div>}
    {params.updated && <div className="flex gap-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" />포럼 관리 작업을 적용하고 감사 로그와 작성자 알림을 남겼습니다.</div>}
    {queryError && <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{queryError.message}</p>}
    <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
      <CardHeader><CardTitle className="text-base">게시글 필터</CardTitle></CardHeader>
      <CardContent><form className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" /><Input name="q" defaultValue={q} className="border-zinc-700 bg-zinc-950 pl-9" placeholder="제목 검색" /></div><select name="category" defaultValue={category} className={selectClass}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select><Button type="submit" variant="outline">검색</Button></form></CardContent>
    </Card>
    <div className="flex flex-col gap-3">
      {(posts ?? []).map((post) => <Card key={post.id} className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">{post.pinned && <Pin className="h-3.5 w-3.5 text-emerald-400" />}<span className="rounded bg-zinc-800 px-2 py-0.5">{post.category}</span><Link href={`/users/${post.user_id}`} className="hover:text-emerald-300">{authorMap.get(post.user_id) ?? "사용자"}</Link><time>{new Date(post.created_at).toLocaleString("ko-KR")}</time></div>
              <Link href={`/forum/${post.id}`} className="mt-2 inline-flex items-center gap-1 font-semibold hover:text-emerald-300">{post.title}<ExternalLink className="h-3.5 w-3.5" /></Link>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{post.content}</p>
              <div className="mt-2 flex gap-4 text-xs text-zinc-500"><span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{post.views}</span><span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{post.forum_likes?.[0]?.count ?? 0}</span><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{post.forum_comments?.[0]?.count ?? 0}</span></div>
            </div>
            <form action={setDeveloperForumPin}><input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="pinned" value={String(!post.pinned)} /><Button type="submit" size="sm" variant="outline" disabled={post.category === "공지" && post.pinned}>{post.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}{post.category === "공지" && post.pinned ? "중요 공지 고정" : post.pinned ? "고정 해제" : "상단 고정"}</Button></form>
          </div>
          <form action={deleteDeveloperForumPost} className="mt-4 grid gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-[1fr_auto]"><input type="hidden" name="post_id" value={post.id} /><Input name="reason" required minLength={3} maxLength={300} className="border-zinc-700 bg-zinc-950" placeholder="삭제 사유 (작성자 알림 및 감사 로그에 기록)" /><ConfirmSubmitButton message="이 게시글과 모든 댓글을 삭제할까요? 작성자에게 삭제 사유가 전송됩니다." /></form>
        </CardContent>
      </Card>)}
      {!posts?.length && !queryError && <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-14 text-center text-sm text-zinc-500">조건에 맞는 게시글이 없습니다.</div>}
    </div>
  </div>;
}

const selectClass = "h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm";
