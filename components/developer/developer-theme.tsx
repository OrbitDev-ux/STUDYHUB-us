"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type DeveloperTheme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "studyhub-developer-theme";
const ThemeContext = createContext<{
  theme: DeveloperTheme;
  setTheme: (theme: DeveloperTheme) => void;
}>({ theme: "system", setTheme: () => undefined });

export function DeveloperThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<DeveloperTheme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light" || saved === "system") setTheme(saved);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemTheme(media.matches ? "dark" : "light");
    updateSystemTheme();
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const resolved = theme === "system" ? systemTheme : theme;
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>
    <div className="developer-console min-h-screen bg-zinc-950 text-zinc-100" data-resolved-theme={resolved}>
      {children}
    </div>
  </ThemeContext.Provider>;
}

export function DeveloperThemeControl() {
  const { theme, setTheme } = useContext(ThemeContext);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return <label className="flex h-9 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
    <Icon className="h-3.5 w-3.5" />
    <span className="sr-only">개발자 화면 테마</span>
    <select
      value={theme}
      onChange={(event) => setTheme(event.target.value as DeveloperTheme)}
      className="bg-transparent text-xs outline-none"
      aria-label="개발자 화면 테마"
    >
      <option value="dark">Dark</option>
      <option value="light">Light</option>
      <option value="system">System</option>
    </select>
  </label>;
}
