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
