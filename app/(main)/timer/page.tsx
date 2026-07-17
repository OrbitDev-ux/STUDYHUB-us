import { PomodoroTimer } from "@/components/timer/pomodoro-timer";

export const metadata = { title: "공부 타이머" };

export default function TimerPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold tracking-tight">공부 타이머</h1>
        <p className="mt-1 text-sm text-muted-foreground">25분 집중, 5분 휴식으로 몰입해요.</p>
      </div>
      <div className="w-full max-w-sm">
        <PomodoroTimer />
      </div>
    </div>
  );
}
