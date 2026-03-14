import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import NavigationLoader from "@/components/NavigationLoader";

export const metadata: Metadata = {
  metadataBase: new URL("https://codespace.yardansh.com"),
  title: "CodeSpace",
  description: "A space to stash simple snippets",
  verification: {
    google: "h75wZ6VzLYZfGhIiDkfQekWaBwC6s19N1NHynZNOgg4",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "CodeSpace",
    description: "A space to stash simple snippets",
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
    description: "A space to stash simple snippets",
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
          <NavigationLoader />
          {children}
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{ __html: `
(function () {
  // Map: keyword dalam aria-label / class / text → animasi SVG
  function getAnim(btn) {
    const label = (btn.getAttribute('aria-label') || btn.textContent || btn.className || '').toLowerCase();
    if (/delete|trash|remove/.test(label))          return 'shake';
    if (/like|heart|love/.test(label))              return 'bounce';
    if (/run|play|execute/.test(label))             return 'spin';
    if (/edit|pencil|rename/.test(label))           return 'jiggle';
    if (/copy|copied|duplicate/.test(label))        return 'pop';
    if (/view|eye|preview/.test(label))             return 'ping';
    if (/save|upload|send|submit|post|register|sign|login/.test(label)) return 'pop';
    if (/download/.test(label))                     return 'bounce';
    if (/refresh|reload|retry/.test(label))         return 'spin';
    if (/dark|light|theme|mode/.test(label))        return 'spin';
    return 'bounce'; // default
  }

  document.addEventListener('mousedown', function (e) {
    var btn = e.target.closest('button, a[href]');
    if (!btn) return;
    if (!btn.querySelector('svg')) return;

    var anim = getAnim(btn);
    var cls  = 'svg-anim-' + anim;

    // Remove existing anim classes first
    ['bounce','shake','spin','pop','ping','jiggle'].forEach(function(a) {
      btn.classList.remove('svg-anim-' + a);
    });

    // Force reflow so animation restarts even if same class
    void btn.offsetWidth;
    btn.classList.add(cls);

    // Remove after animation finishes
    setTimeout(function () { btn.classList.remove(cls); }, 550);
  }, true);
})();
        ` }} />
      </body>
    </html>
  );
}