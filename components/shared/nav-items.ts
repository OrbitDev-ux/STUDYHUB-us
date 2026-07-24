import { LayoutDashboard, NotebookPen, CalendarClock, Timer, BookX, LineChart, Trophy, User, LibraryBig, CalendarDays, Swords, Medal, MessagesSquare, MessageCircle, Code2, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/streak", labelKey: "streak", icon: CalendarDays },
  { href: "/practice", labelKey: "practice", icon: LibraryBig },
  { href: "/battle", labelKey: "battle", icon: Swords },
  { href: "/contests", labelKey: "contests", icon: Medal },
  { href: "/judge", labelKey: "judge", icon: Code2 },
  { href: "/homework", labelKey: "homework", icon: NotebookPen },
  { href: "/planner", labelKey: "planner", icon: CalendarClock },
  { href: "/timer", labelKey: "timer", icon: Timer },
  { href: "/wrong-notes", labelKey: "wrongNotes", icon: BookX },
  { href: "/report", labelKey: "report", icon: LineChart },
  { href: "/rank", labelKey: "rank", icon: Trophy },
  { href: "/forum", labelKey: "forum", icon: MessagesSquare },
  { href: "/messages", labelKey: "messages", icon: MessageCircle },
  { href: "/profile", labelKey: "profile", icon: User },
  { href: "/settings", labelKey: "settings", icon: Settings },
] as const;

export const MOBILE_NAV_ITEMS = [
  NAV_ITEMS[0], NAV_ITEMS[3], NAV_ITEMS[4], NAV_ITEMS[12], NAV_ITEMS[13], NAV_ITEMS[14],
];
