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
  // maximumScale removed — blocks user zoom, fails accessibility audit
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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