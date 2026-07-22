"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Coffee, BookOpen, Loader2, CheckCircle2 } from "lucide-react";
import { beginStudySession, saveStudySession } from "@/app/(main)/timer/actions";
import { cn } from "@/lib/utils/cn";
import type { SubjectId } from "@/types";

const SUBJECT_IDS: SubjectId[] = ["math", "english", "social", "science"];

export function PomodoroTimer({
  focusMinutes,
  breakMinutes,
  todayMinutes,
  todaySessions,
}: {
  focusMinutes: number;
  breakMinutes: number;
  todayMinutes: number;
  todaySessions: number;
}) {
  const t = useTranslations("timer");
  const ts = useTranslations("subjects");
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useState<SubjectId>("math");
  const [completedFocusSeconds, setCompletedFocusSeconds] = useState(0);
  const [completedBreakSeconds, setCompletedBreakSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number | null>(null);

  const phaseMinutes = mode === "focus" ? focusMinutes : breakMinutes;
  const phaseTotalSeconds = phaseMinutes * 60;
  const currentPhaseElapsed = Math.max(0, phaseTotalSeconds - secondsLeft);
  const totalFocusSeconds = completedFocusSeconds + (mode === "focus" ? currentPhaseElapsed : 0);
  const displayedFocusMinutes = Math.floor(totalFocusSeconds / 60);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline !== null) setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (!sessionId) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [sessionId]);

  useEffect(() => {
    if (secondsLeft !== 0 || !running) return;

    if (mode === "focus") {
      setCompletedFocusSeconds((value) => value + focusMinutes * 60);
      setMode("break");
      setSecondsLeft(breakMinutes * 60);
      deadlineRef.current = Date.now() + breakMinutes * 60_000;
      playChime();
    } else {
      setCompletedBreakSeconds((value) => value + breakMinutes * 60);
      setMode("focus");
      setSecondsLeft(focusMinutes * 60);
      deadlineRef.current = Date.now() + focusMinutes * 60_000;
      playChime();
    }
  }, [secondsLeft, running, mode, focusMinutes, breakMinutes]);

  async function handleStop() {
    setRunning(false);
    deadlineRef.current = null;
    if (intervalRef.current) clearInterval(intervalRef.current);

    const focusSeconds = completedFocusSeconds + (mode === "focus" ? currentPhaseElapsed : 0);
    const breakSeconds = completedBreakSeconds + (mode === "break" ? currentPhaseElapsed : 0);

    if (focusSeconds < 30 || !sessionId) {
      setMessage({ type: "error", text: t("minimumSave") });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await saveStudySession({
        sessionId,
        focusMinutes: Math.max(1, Math.round(focusSeconds / 60)),
        breakMinutes: Math.round(breakSeconds / 60),
        interrupted: secondsLeft > 0 && mode === "focus",
      });
      resetTimer();
      setMessage({ type: "success", text: t("saved") });
    } catch {
      setMessage({ type: "error", text: t("saveError") });
    } finally {
      setSaving(false);
    }
  }

  function resetTimer() {
    setRunning(false);
    setCompletedFocusSeconds(0);
    setCompletedBreakSeconds(0);
    setMode("focus");
    setSecondsLeft(focusMinutes * 60);
    setSessionId(null);
    deadlineRef.current = null;
  }

  async function toggleTimer() {
    if (running) {
      if (deadlineRef.current !== null) {
        setSecondsLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      }
      deadlineRef.current = null;
      setRunning(false);
      return;
    }
    if (sessionId) {
      deadlineRef.current = Date.now() + secondsLeft * 1000;
      setRunning(true);
      return;
    }

    setStarting(true);
    setMessage(null);
    try {
      const id = await beginStudySession(subject);
      setSessionId(id);
      deadlineRef.current = Date.now() + secondsLeft * 1000;
      setRunning(true);
    } catch {
      setMessage({ type: "error", text: t("startError") });
    } finally {
      setStarting(false);
    }
  }

  const progress = ((phaseTotalSeconds - secondsLeft) / phaseTotalSeconds) * 100;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-bold">{todayMinutes}</p>
          <p className="text-xs text-muted-foreground">{t("todayMinutes")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-bold">{todaySessions}</p>
          <p className="text-xs text-muted-foreground">{t("todaySessions")}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <div className="flex flex-wrap justify-center gap-2">
            {SUBJECT_IDS.map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => setSubject(id)}
                disabled={running || saving || starting || sessionId !== null}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                  subject === id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                {ts(id)}
              </button>
            ))}
          </div>

          <div className="relative flex h-56 w-56 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
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
              {mode === "focus" ? <BookOpen className="h-5 w-5 text-primary" /> : <Coffee className="h-5 w-5 text-success" />}
              <span className="text-4xl font-bold tabular-nums" aria-live="polite">{mm}:{ss}</span>
              <span className="text-xs text-muted-foreground">{mode === "focus" ? t("focusLabel") : t("breakLabel")}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button size="lg" onClick={toggleTimer} disabled={saving || starting} className="gap-2">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {starting ? t("starting") : running ? t("pause") : t("start")}
            </Button>
            <Button size="lg" variant="outline" onClick={handleStop} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("stopAndSave")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">{t("sessionTotal", { minutes: displayedFocusMinutes })}</p>
          {message && (
            <p role="status" className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", message.type === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              {message.type === "success" && <CheckCircle2 className="h-4 w-4" />}
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function playChime() {
  if (typeof window === "undefined") return;
  new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {});
}
