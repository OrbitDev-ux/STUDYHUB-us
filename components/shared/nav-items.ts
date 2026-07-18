import { LayoutDashboard, NotebookPen, CalendarClock, Timer, BookX, LineChart, Trophy, User } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/homework", labelKey: "homework", icon: NotebookPen },
  { href: "/planner", labelKey: "planner", icon: CalendarClock },
  { href: "/timer", labelKey: "timer", icon: Timer },
  { href: "/wrong-notes", labelKey: "wrongNotes", icon: BookX },
  { href: "/report", labelKey: "report", icon: LineChart },
  { href: "/rank", labelKey: "rank", icon: Trophy },
  { href: "/profile", labelKey: "profile", icon: User },
] as const;

export const MOBILE_NAV_ITEMS = [
  NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[3], NAV_ITEMS[4], NAV_ITEMS[7],
];
