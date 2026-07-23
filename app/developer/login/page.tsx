import Link from "next/link";
import { redirect } from "next/navigation";
import { Code2, KeyRound, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasDeveloperSession } from "@/lib/developer/auth";
import { developerLogin } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeveloperRole } from "@/lib/developer/roles";

export const metadata = { title: "Developer Login" };

const ERRORS: Record<string, string> = {
  missing_fields: "이메일과 비밀번호를 입력해주세요.",
  invalid_credentials: "개발자 인증 정보가 올바르지 않습니다.",
  access_denied: "이 계정에는 개발자 권한이 없습니다.",
  rate_limited: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
  special_login_required: "개발자 전용 로그인이 필요하거나 세션이 만료되었습니다.",
};

export default async function DeveloperLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (isDeveloperRole(profile?.role) && await hasDeveloperSession(user.id)) redirect("/developer");
  }
  const { error } = await searchParams;

  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2 text-xl font-bold"><Code2 className="h-6 w-6 text-emerald-400" />StudyHub Developer</div>
      <Card className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-emerald-400" />Restricted Access</CardTitle><p className="text-sm text-zinc-400">Admin 또는 Super Admin 역할이 부여된 계정만 접근할 수 있습니다.</p></CardHeader>
        <CardContent>
          <form action={developerLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label htmlFor="developer-email">Developer Email</Label><Input id="developer-email" name="email" type="email" autoComplete="username" required className="border-zinc-700 bg-zinc-950" /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="developer-password">Password</Label><Input id="developer-password" name="password" type="password" autoComplete="current-password" required className="border-zinc-700 bg-zinc-950" /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="developer-code">Access Code</Label><div className="relative"><KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" /><Input id="developer-code" name="access_code" type="password" autoComplete="one-time-code" className="border-zinc-700 bg-zinc-950 pl-9" placeholder="서버에 설정된 경우 필수" /></div></div>
            {error && <p className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{ERRORS[error] ?? "인증에 실패했습니다."}</p>}
            <Button type="submit" className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400">개발자 콘솔 로그인</Button>
          </form>
        </CardContent>
      </Card>
      <Button asChild variant="link" className="mt-4 w-full text-zinc-400"><Link href="/">StudyHub로 돌아가기</Link></Button>
    </div>
  </main>;
}
