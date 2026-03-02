import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "CodeSpace",
  description: "A place to share simple snippets",
  openGraph: {
    title: "CodeSpace",
    description: "A place to share simple snippets",
    images: [
      {
        url: "https://cdn.nekohime.site/file/E_fVqMJ-.png",
        width: 1280,
        height: 640,
      },
    ],
  },
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
    // suppressHydrationWarning: mencegah React error #418/#422
    // karena blocking script mengubah data-theme di client sebelum hydration,
    // yang menyebabkan mismatch antara server HTML dan client DOM.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Blocking script — jalan SEBELUM browser render apapun.
          Baca localStorage dan set data-theme di <html> seketika,
          sehingga Navbar langsung dapat tema yang benar dari frame pertama.
          Default: "light" jika belum pernah pilih tema.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})();`,
          }}
        />
        <link rel="icon" type="image/x-icon" href="https://cdn.nekohime.site/file/sOyPp0Jp.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="https://cdn.nekohime.site/file/R-r5NgoD.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="https://cdn.nekohime.site/file/R-r5NgoD.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="https://cdn.nekohime.site/file/sOyPp0Jp.png" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}