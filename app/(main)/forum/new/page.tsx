import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createForumPost } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Megaphone } from "lucide-react";
import { isDeveloperRole } from "@/lib/developer/roles";

export default async function NewForumPostPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = isDeveloperRole(profile?.role);
  return <Card><CardHeader><CardTitle>{isAdmin ? "관리자 중요 공지 작성" : "새 게시글"}</CardTitle><CardDescription>{isAdmin ? "관리자가 작성한 글은 중요 공지로 분류되어 항상 상단에 고정되고 모든 사용자에게 알림이 전송됩니다." : "개인정보나 연락처를 공개하지 않도록 주의해주세요."}</CardDescription></CardHeader><CardContent><form action={createForumPost} className="flex flex-col gap-4">{isAdmin ? <><input type="hidden" name="category" value="공지" /><div className="flex gap-3 rounded-xl border border-primary/30 bg-accent p-4 text-sm"><Megaphone className="h-5 w-5 shrink-0 text-primary" /><div><strong>중요 공지 자동 등록</strong><p className="mt-1 text-xs text-muted-foreground">게시 즉시 상단 고정 · 전체 사용자 실시간 알림 · 관리자 감사 로그가 적용됩니다.</p></div></div></> : <div className="flex flex-col gap-2"><Label>분류</Label><select name="category" className="h-10 rounded-md border border-input bg-background px-3"><option>자유</option><option>질문</option><option>공부팁</option><option>대회</option></select></div>}<div className="flex flex-col gap-2"><Label htmlFor="post-title">제목</Label><Input id="post-title" name="title" minLength={2} maxLength={120} required /></div><div className="flex flex-col gap-2"><Label htmlFor="post-content">내용</Label><textarea id="post-content" name="content" minLength={2} maxLength={10000} rows={14} required className="rounded-xl border border-input bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring" /></div><Button type="submit">{isAdmin ? <><Megaphone className="h-4 w-4" />중요 공지 게시 및 전체 알림</> : "게시하기"}</Button></form></CardContent></Card>;
}
