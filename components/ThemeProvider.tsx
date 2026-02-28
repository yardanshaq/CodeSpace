"use client";

/**
 * ThemeProvider — menyediakan context dark/light mode ke seluruh aplikasi.
 *
 * PENTING: jangan return null saat belum mounted — ini penyebab blank putih
 * di Safari iOS dan Android WebView. Solusinya: selalu render children,
 * biarkan tema mungkin flash sebentar dari light ke dark (FOUC minimal),
 * tapi halaman tidak pernah kosong.
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
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Baca preferensi yang tersimpan, atau deteksi dari system preference
    const stored    = localStorage.getItem("theme") as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initial   = stored ?? preferred;

    setTheme(initial as Theme);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  // Selalu render children — tidak pernah return null
  // (return null = blank putih di mobile)
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
