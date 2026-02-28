import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import DevToolsGuard from "@/components/DevToolsGuard";

export const metadata: Metadata = {
  title: "CodeSpace",
  description: "A place to share simple snippets",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Script blocking ini dieksekusi SEBELUM browser render apapun.
          Membaca localStorage dan langsung set data-theme di <html>,
          sehingga tidak ada flash light mode saat reload di dark mode.
          dangerouslySetInnerHTML diperlukan karena ini raw JS, bukan JSX.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = stored || preferred;
    document.documentElement.setAttribute('data-theme', theme);
  } catch(e) {}
})();
            `.trim(),
          }}
        />
        <link rel="icon" type="image/x-icon" href="https://cdn.nekohime.site/file/sOyPp0Jp.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="https://cdn.nekohime.site/file/R-r5NgoD.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="https://cdn.nekohime.site/file/R-r5NgoD.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="https://cdn.nekohime.site/file/sOyPp0Jp.png" />
      </head>
      <body>
        <ThemeProvider>
          <DevToolsGuard>
            {children}
          </DevToolsGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}