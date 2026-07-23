import { notFound, redirect } from "next/navigation";
import { Heart, MessageCircle, Pin, Trash2 } from "lucide-react";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { addForumComment, deleteForumComment, deleteForumPost, toggleForumLike } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingBadge, RatingName } from "@/components/battle/rating-identity";

export default async function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  await supabase.rpc("increment_forum_views", { p_post_id: id });
  const [{ data: post }, { data: comments }, { count: likeCount }, { data: myLike }] = await Promise.all([
    supabase.from("forum_posts").select("*").eq("id", id).single(),
    supabase.from("forum_comments").select("*").eq("post_id", id).order("created_at"),
    supabase.from("forum_likes").select("user_id", { count: "exact", head: true }).eq("post_id", id),
    supabase.from("forum_likes").select("post_id").eq("post_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!post) notFound();
  const ids = [...new Set([post.user_id, ...(comments ?? []).map((comment) => comment.user_id)])];
  const admin = createAdminClient();
  const [{ data: authors }, { data: authorRatings }] = await Promise.all([
    admin.from("profiles").select("id, nickname, avatar_url").in("id", ids),
    admin.from("battle_ratings").select("user_id, rating").in("user_id", ids),
  ]);
  const authorMap = new Map((authors ?? []).map((author) => [author.id, author]));
  const ratingMap = new Map((authorRatings ?? []).map((rating) => [rating.user_id, rating.rating]));
  const postRating = ratingMap.get(post.user_id) ?? 1200;
  const important = post.category === "공지" && post.pinned;
  return <div className="flex flex-col gap-5"><Card className={important ? "border-primary/50 bg-accent/30" : ""}><CardHeader><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap items-center gap-2">{important && <Pin className="h-4 w-4 text-primary" />}<Badge variant={important ? "warning" : "secondary"}>{important ? "중요 공지" : post.category}</Badge><RatingName nickname={authorMap.get(post.user_id)?.nickname ?? "사용자"} rating={postRating} userId={post.user_id} className="text-xs" /><RatingBadge rating={postRating} compact /><span className="text-xs text-muted-foreground">· {new Date(post.created_at).toLocaleString("ko-KR")}</span></div><CardTitle>{post.title}</CardTitle></div>{post.user_id === user.id && <form action={deleteForumPost.bind(null, id)}><Button variant="outline" size="sm"><Trash2 className="h-4 w-4" /></Button></form>}</div></CardHeader><CardContent><p className="whitespace-pre-wrap break-words text-sm leading-7">{post.content}</p><form action={toggleForumLike.bind(null, id)} className="mt-6"><Button variant={myLike ? "default" : "outline"} size="sm"><Heart className="mr-2 h-4 w-4" />좋아요 {likeCount ?? 0}</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4" />댓글 {comments?.length ?? 0}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{(comments ?? []).map((comment) => { const rating = ratingMap.get(comment.user_id) ?? 1200; return <div key={comment.id} className="rounded-xl bg-secondary/60 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><RatingName nickname={authorMap.get(comment.user_id)?.nickname ?? "사용자"} rating={rating} userId={comment.user_id} className="text-xs" /><RatingBadge rating={rating} compact /></div>{comment.user_id === user.id && <form action={deleteForumComment.bind(null, comment.id, id)}><Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button></form>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{comment.content}</p><p className="mt-2 text-[11px] text-muted-foreground">{new Date(comment.created_at).toLocaleString("ko-KR")}</p></div>; })}<form action={addForumComment.bind(null, id)} className="flex gap-2"><textarea name="content" maxLength={2000} required rows={2} placeholder="댓글을 입력하세요" className="min-h-12 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" /><Button type="submit">등록</Button></form></CardContent></Card>
  </div>;
}
