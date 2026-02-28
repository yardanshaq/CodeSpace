"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe: selalu mulai dari "light" saat server render
  // agar tidak terjadi hydration mismatch (error #418/#422).
  // Nilai sebenarnya dibaca di useEffect (client-only).
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Setelah mount, baca dari <html data-theme> yang sudah di-set
    // oleh blocking script — tidak perlu baca localStorage lagi.
    const attr = document.documentElement.getAttribute("data-theme");
    const initial: Theme = attr === "dark" ? "dark" : "light";
    setTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  // Tidak pernah return null — mencegah blank putih di mobile
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}