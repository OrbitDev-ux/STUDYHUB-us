import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Heart, MessageCircle, MessagesSquare, PenLine, Pin } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RatingName } from "@/components/battle/rating-identity";

export const metadata = { title: "커뮤니티 포럼" };
const CATEGORIES = ["전체", "자유", "질문", "공부팁", "대회", "공지"];

export default async function ForumPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { category = "전체" } = await searchParams;
  let query = supabase.from("forum_posts").select("*, forum_comments(count), forum_likes(count)").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  if (CATEGORIES.includes(category) && category !== "전체") query = query.eq("category", category);
  const { data: posts } = await query;
  const authorIds = [...new Set((posts ?? []).map((post) => post.user_id))];
  const admin = createAdminClient();
  const [{ data: authors }, { data: authorRatings }] = authorIds.length ? await Promise.all([
    admin.from("profiles").select("id, nickname, avatar_url").in("id", authorIds),
    admin.from("battle_ratings").select("user_id, rating").in("user_id", authorIds),
  ]) : [{ data: [] }, { data: [] }];
  const authorMap = new Map((authors ?? []).map((author) => [author.id, author]));
  const ratingMap = new Map((authorRatings ?? []).map((rating) => [rating.user_id, rating.rating]));

  return <div className="flex flex-col gap-6"><div className="flex items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><MessagesSquare className="h-6 w-6 text-primary" /> 커뮤니티 포럼</h1><p className="mt-1 text-sm text-muted-foreground">질문과 공부법을 나누고 대회 이야기를 함께해요.</p></div><Button asChild><Link href="/forum/new"><PenLine className="mr-2 h-4 w-4" />글쓰기</Link></Button></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{CATEGORIES.map((item) => <Button key={item} asChild variant={category === item ? "default" : "outline"} size="sm"><Link href={item === "전체" ? "/forum" : `/forum?category=${encodeURIComponent(item)}`}>{item}</Link></Button>)}</div>
    <div className="flex flex-col gap-3">{(posts ?? []).length === 0 && <Card><CardContent className="py-14 text-center text-muted-foreground">첫 번째 글을 작성해보세요.</CardContent></Card>}{(posts ?? []).map((post) => { const author = authorMap.get(post.user_id); return <Link key={post.id} href={`/forum/${post.id}`}><Card className="transition hover:border-primary"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex items-center gap-2">{post.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}<Badge variant="secondary">{post.category}</Badge><RatingName nickname={author?.nickname ?? "사용자"} rating={ratingMap.get(post.user_id) ?? 1200} className="text-xs" /></div><h2 className="truncate font-semibold">{post.title}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.content}</p></div><div className="flex shrink-0 gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{post.views}</span><span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{post.forum_likes?.[0]?.count ?? 0}</span><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{post.forum_comments?.[0]?.count ?? 0}</span></div></div><p className="mt-3 text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString("ko-KR")}</p></CardContent></Card></Link>; })}</div>
  </div>;
}
