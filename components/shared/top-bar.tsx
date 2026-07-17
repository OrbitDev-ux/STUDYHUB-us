"use client";

import { Coins, Moon, Sun, LogOut, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";
import { signOut } from "@/app/(auth)/actions";
import { getLevelProgress } from "@/lib/gamification/level";
import type { Profile } from "@/types";

export function TopBar({ profile }: { profile: Profile | null }) {
  const { theme, setTheme } = useTheme();
  const progress = getLevelProgress(profile?.xp ?? 0);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <div className="text-sm font-medium text-muted-foreground md:hidden">StudyHub</div>
      <div className="hidden text-sm text-muted-foreground md:block">
        안녕하세요, <span className="font-semibold text-foreground">{profile?.nickname}</span>님
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          title={`다음 레벨까지 ${progress.nextLevelXp - progress.xp}XP (${progress.progressPercent}%)`}
        >
          <Star className="h-3.5 w-3.5 text-primary" /> Lv.{progress.level}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
          <Zap className="h-3.5 w-3.5 text-primary" /> {profile?.xp ?? 0} XP
        </div>
        <div className="hidden items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold sm:flex">
          <Coins className="h-3.5 w-3.5 text-warning" /> {profile?.coins ?? 0}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="다크모드 전환"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" aria-label="로그아웃">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
