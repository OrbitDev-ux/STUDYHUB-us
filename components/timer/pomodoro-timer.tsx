"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Coffee, BookOpen } from "lucide-react";
import { saveStudySession } from "@/app/(main)/timer/actions";
import { cn } from "@/lib/utils/cn";
import type { SubjectId } from "@/types";

const FOCUS_MIN = 25;
const BREAK_MIN = 5;

const SUBJECT_IDS: SubjectId[] = ["math", "english", "social", "science"];

export function PomodoroTimer() {
  const t = useTranslations("timer");
  const ts = useTranslations("subjects");
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useState<SubjectId>("math");
  const [completedFocusMinutes, setCompletedFocusMinutes] = useState(0);
  const [completedBreakMinutes, setCompletedBreakMinutes] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            handlePhaseEnd();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function handlePhaseEnd() {
    if (mode === "focus") {
      setCompletedFocusMinutes((m) => m + FOCUS_MIN);
      setMode("break");
      setSecondsLeft(BREAK_MIN * 60);
      new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
      ).play().catch(() => {});
    } else {
      setCompletedBreakMinutes((m) => m + BREAK_MIN);
      setMode("focus");
      setSecondsLeft(FOCUS_MIN * 60);
    }
  }

  async function handleStop() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (completedFocusMinutes > 0) {
      await saveStudySession({
        subjectId: subject,
        mode: "pomodoro",
        focusMinutes: completedFocusMinutes,
        breakMinutes: completedBreakMinutes,
        interrupted: secondsLeft > 0 && mode === "focus",
      });
    }
    setCompletedFocusMinutes(0);
    setCompletedBreakMinutes(0);
    setMode("focus");
    setSecondsLeft(FOCUS_MIN * 60);
  }

  const totalSeconds = (mode === "focus" ? FOCUS_MIN : BREAK_MIN) * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 p-8">
        <div className="flex gap-2">
          {SUBJECT_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setSubject(id)}
              disabled={running}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                subject === id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >
              {ts(id)}
            </button>
          ))}
        </div>

        <div className="relative flex h-56 w-56 items-center justify-center">
          <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={mode === "focus" ? "hsl(var(--primary))" : "hsl(var(--success))"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 90}
              strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="flex flex-col items-center gap-1">
            {mode === "focus" ? (
              <BookOpen className="h-5 w-5 text-primary" />
            ) : (
              <Coffee className="h-5 w-5 text-success" />
            )}
            <span className="text-4xl font-bold tabular-nums">
              {mm}:{ss}
            </span>
            <span className="text-xs text-muted-foreground">{mode === "focus" ? t("focusLabel") : t("breakLabel")}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button size="lg" onClick={() => setRunning((r) => !r)} className="gap-2">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? t("pause") : t("start")}
          </Button>
          <Button size="lg" variant="outline" onClick={handleStop} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("stopAndSave")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("sessionTotal", { minutes: completedFocusMinutes })}
        </p>
      </CardContent>
    </Card>
  );
}
