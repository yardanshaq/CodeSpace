import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://codespace.yardansh.com"),
  title: "CodeSpace",
  description: "A place to share simple snippets",
  verification: {
    google: "h75wZ6VzLYZfGhIiDkfQekWaBwC6s19N1NHynZNOgg4",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "CodeSpace",
    description: "A place to share simple snippets",
    url: "https://codespace.yardansh.com",
    siteName: "CodeSpace",
    images: [
      {
        url: "https://cdn.nekohime.site/file/E_fVqMJ-.png",
        width: 1280,
        height: 640,
        alt: "CodeSpace Cover",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CodeSpace",
    description: "A place to share simple snippets",
    images: ["https://cdn.nekohime.site/file/E_fVqMJ-.png"],
  },
  icons: {
    icon: [
      { url: "https://cdn.nekohime.site/file/1_6Wo0X-.png" },
      { url: "https://cdn.nekohime.site/file/nMZIBy7P.png", sizes: "16x16", type: "image/png" },
      { url: "https://cdn.nekohime.site/file/dtbHw_6g.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "https://cdn.nekohime.site/file/E4zGn2Ro.png", sizes: "180x180" },
    ],
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          media="print"
          // @ts-ignore
          onLoad="this.media='all'"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          />
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}