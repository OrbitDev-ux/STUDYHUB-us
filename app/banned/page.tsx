import { Ban, Clock3, LogOut, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Account Banned" };

export default async function BannedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("nickname,is_banned,banned_until,ban_reason,banned_at")
    .eq("id", user.id)
    .single();
  const isBanned = Boolean(
    profile?.is_banned
    && (!profile.banned_until || new Date(profile.banned_until).getTime() > Date.now())
  );
  if (!isBanned) redirect("/dashboard");

  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
    <Card className="w-full max-w-xl border-red-900/70 bg-zinc-900 text-zinc-100">
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-red-900 bg-red-950/50 text-red-400"><Ban className="h-10 w-10" /></span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-red-400">Account disabled</p>
        <h1 className="mt-3 text-3xl font-bold">The user is banned.</h1>
        <p className="mt-3 text-sm text-zinc-400">{profile?.nickname} 계정은 현재 StudyHub를 이용할 수 없습니다.</p>
        <div className="mt-8 w-full space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left text-sm">
          <p className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><span><strong className="text-zinc-300">사유</strong><br /><span className="text-zinc-500">{profile?.ban_reason || "운영 정책 위반"}</span></span></p>
          <p className="flex items-start gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><span><strong className="text-zinc-300">기간</strong><br /><span className="text-zinc-500">{profile?.banned_until ? `${new Date(profile.banned_until).toLocaleString("ko-KR")}까지` : "영구 정지"}</span></span></p>
        </div>
        <p className="mt-5 text-xs leading-5 text-zinc-600">밴 계정은 Rating·XP·배틀·대회 리더보드에서 제외됩니다. 조치가 잘못되었다고 생각하면 운영진에게 문의해주세요.</p>
        <form action={signOut} className="mt-8"><Button type="submit" variant="outline"><LogOut className="h-4 w-4" />로그아웃</Button></form>
      </CardContent>
    </Card>
  </main>;
}
