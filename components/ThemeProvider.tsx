"use client";

/**
 * ThemeProvider — menyediakan context dark/light mode ke seluruh aplikasi.
 *
 * Fix FOUC: tema awal sekarang dibaca langsung dari document.documentElement
 * (yang sudah di-set oleh inline script di layout.tsx sebelum render),
 * bukan dari state "light" default. Ini mencegah flash light mode saat reload.
 */

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
  // Baca tema langsung dari <html data-theme="..."> yang sudah di-set
  // oleh blocking script di layout.tsx — tidak ada default "light" lagi.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "dark" || attr === "light") return attr;
    }
    return "light";
  });

  useEffect(() => {
    // Sync ulang saat mount — handle SSR vs client mismatch
    const stored    = localStorage.getItem("theme") as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initial   = stored ?? preferred;

    // Hanya update jika berbeda (hindari re-render tidak perlu)
    if (initial !== theme) {
      setTheme(initial);
    }
    document.documentElement.setAttribute("data-theme", initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}