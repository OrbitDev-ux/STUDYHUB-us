import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createForumPost } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function NewForumPostPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return <Card><CardHeader><CardTitle>새 게시글</CardTitle><CardDescription>개인정보나 연락처를 공개하지 않도록 주의해주세요.</CardDescription></CardHeader><CardContent><form action={createForumPost} className="flex flex-col gap-4"><div className="flex flex-col gap-2"><Label>분류</Label><select name="category" className="h-10 rounded-md border border-input bg-background px-3"><option>자유</option><option>질문</option><option>공부팁</option><option>대회</option>{profile?.role === "admin" && <option>공지</option>}</select></div><div className="flex flex-col gap-2"><Label htmlFor="post-title">제목</Label><Input id="post-title" name="title" minLength={2} maxLength={120} required /></div><div className="flex flex-col gap-2"><Label htmlFor="post-content">내용</Label><textarea id="post-content" name="content" minLength={2} maxLength={10000} rows={14} required className="rounded-xl border border-input bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring" /></div><Button type="submit">게시하기</Button></form></CardContent></Card>;
}
