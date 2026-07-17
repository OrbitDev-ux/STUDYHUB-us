import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { signUpWithEmail } from "../actions";
import { OAuthButtons } from "@/components/shared/oauth-buttons";

export const metadata = { title: "회원가입" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>가입 후 바로 AI 진단평가를 시작해요</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <OAuthButtons />
        <div className="relative flex items-center py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="px-3 text-xs text-muted-foreground">또는 이메일로 가입</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={signUpWithEmail} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nickname">닉네임</Label>
            <Input id="nickname" name="nickname" placeholder="공부왕" required maxLength={20} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
            <p className="text-xs text-muted-foreground">8자 이상 입력해주세요</p>
          </div>
          {params.error && <p className="text-sm text-destructive">가입 중 문제가 발생했어요. 다시 시도해주세요.</p>}
          <Button type="submit" className="mt-2">
            가입하고 진단평가 시작하기
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
