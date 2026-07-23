import Link from "next/link";
import { Activity, BarChart3, BookOpenCheck, Code2, Crown, FileQuestion, FlaskConical, LogOut, Megaphone, MessagesSquare, Palette, ScrollText, ShieldAlert, Swords, UsersRound } from "lucide-react";
import { requireDeveloper } from "@/lib/developer/auth";
import { isSuperAdminRole } from "@/lib/developer/roles";
import { developerLogout } from "../actions";
import { Button } from "@/components/ui/button";
import { DeveloperThemeControl, DeveloperThemeProvider } from "@/components/developer/developer-theme";
import { RatingTierProvider } from "@/components/battle/rating-tier-provider";

const ITEMS = [
  { href: "/developer", label: "Overview", icon: BarChart3 },
  { href: "/developer/guide", label: "Guide", icon: BookOpenCheck },
  { href: "/developer/questions", label: "Questions", icon: FileQuestion },
  { href: "/developer/judge", label: "Online Judge", icon: FlaskConical },
  { href: "/developer/contests", label: "Contests", icon: Swords },
  { href: "/developer/users", label: "Users", icon: UsersRound },
  { href: "/developer/ratings", label: "Rating Events", icon: Activity },
  { href: "/developer/rating-tiers", label: "Rating Tiers", icon: Palette },
  { href: "/developer/notifications", label: "Announcements", icon: Megaphone },
  { href: "/developer/forum", label: "Forum", icon: MessagesSquare },
  { href: "/developer/reports", label: "Chat Reports", icon: ShieldAlert },
  { href: "/developer/audit", label: "Audit Log", icon: ScrollText },
];

export default async function DeveloperConsoleLayout({ children }: { children: React.ReactNode }) {
  const { profile, admin } = await requireDeveloper();
  const { data: appSettings } = await admin.from("app_settings").select("rating_tiers").eq("id", true).maybeSingle();
  return <RatingTierProvider value={appSettings?.rating_tiers}><DeveloperThemeProvider>
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/developer" className="flex items-center gap-2 font-bold"><Code2 className="h-5 w-5 text-emerald-400" />StudyHub Developer</Link>
        <div className="flex items-center gap-3"><DeveloperThemeControl />{isSuperAdminRole(profile.role) && <span className="hidden items-center gap-1 rounded-full border border-violet-800 bg-violet-950/40 px-2 py-1 text-[10px] font-semibold text-violet-300 sm:flex"><Crown className="h-3 w-3" />Super Admin</span>}<span className="hidden text-xs text-zinc-400 lg:block">{profile.nickname}</span><form action={developerLogout}><Button type="submit" size="sm" variant="outline" className="border-zinc-700"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">로그아웃</span></Button></form></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[190px_minmax(0,1fr)]">
      <aside><nav className="flex gap-2 overflow-x-auto md:sticky md:top-20 md:flex-col">{ITEMS.map((item) => <Link key={item.href} href={item.href} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-emerald-300"><item.icon className="h-4 w-4" />{item.label}</Link>)}</nav></aside>
      <main className="min-w-0">{children}</main>
    </div>
  </DeveloperThemeProvider></RatingTierProvider>;
}
