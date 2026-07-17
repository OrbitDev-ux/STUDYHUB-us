import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MailCheck } from "lucide-react";

export const metadata = { title: "이메일을 확인해주세요" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle>이메일을 확인해주세요</CardTitle>
        <CardDescription>
          인증 링크를 보내드렸어요. 이메일의 링크를 클릭하면 가입이 완료됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
