import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";
const KEY = "wc26.theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark");
  if (theme === "light") root.classList.add("theme-light");
  if (theme === "dark") root.classList.add("theme-dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(next: Theme) {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {}
    setThemeState(next);
  }

  return { theme, setTheme };
}
