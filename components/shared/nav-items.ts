import { LayoutDashboard, NotebookPen, CalendarClock, Timer, BookX, LineChart, Trophy, User } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/homework", label: "오늘의 숙제", icon: NotebookPen },
  { href: "/planner", label: "학습 플래너", icon: CalendarClock },
  { href: "/timer", label: "타이머", icon: Timer },
  { href: "/wrong-notes", label: "오답노트", icon: BookX },
  { href: "/report", label: "AI 리포트", icon: LineChart },
  { href: "/rank", label: "랭킹/배지", icon: Trophy },
  { href: "/profile", label: "프로필", icon: User },
] as const;

export const MOBILE_NAV_ITEMS = [
  NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[3], NAV_ITEMS[4], NAV_ITEMS[7],
];
