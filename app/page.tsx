import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Target, Flame, NotebookPen, Timer, Trophy } from "lucide-react";

const features = [
  { icon: Brain, title: "AI 진단평가", desc: "가입 직후 4과목 실력을 진단하고 예상 등급을 계산해요." },
  { icon: Target, title: "취약점 분석", desc: "어떤 단원이 왜 약한지 AI가 원인과 학습 방향을 알려줘요." },
  { icon: NotebookPen, title: "매일 AI 숙제", desc: "취약 단원 위주로 매일 아침 자동으로 숙제가 생성돼요." },
  { icon: Timer, title: "포모도로 타이머", desc: "집중 시간을 측정하고 휴식까지 관리해줘요." },
  { icon: Flame, title: "연속 학습 스트릭", desc: "XP, 코인, 배지로 공부 습관을 게임처럼 만들어요." },
  { icon: Trophy, title: "일일 AI 피드백", desc: "오늘 공부를 요약하고 내일 할 일을 추천해줘요." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="container flex h-16 items-center justify-between">
        <span className="text-lg font-bold tracking-tight">StudyHub</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">로그인</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">무료로 시작하기</Link>
          </Button>
        </div>
      </header>

      <section className="container flex flex-col items-center gap-6 py-24 text-center animate-fade-in">
        <div className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
          매일 공부를 관리해주는 AI 과외 선생님
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          AI가 실력을 진단하고,
          <br /> 매일 공부를 설계해드려요
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          진단평가부터 예상 등급, 취약점 분석, 숙제와 학습 계획까지 —
          StudyHub가 매일 당신의 개인 과외 선생님이 되어드립니다.
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <Link href="/signup">무료로 진단받기</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">로그인</Link>
          </Button>
        </div>
      </section>

      <section className="container grid grid-cols-1 gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="animate-slide-up">
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} StudyHub. All rights reserved.
      </footer>
    </main>
  );
}
