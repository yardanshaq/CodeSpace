import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import NavigationLoader from "@/components/NavigationLoader";

export const metadata: Metadata = {
  metadataBase: new URL("https://codespace.yardansh.com"),
  title: "CodeSpace",
  description: "A code snippet sharing platform",
  keywords: ["code snippet", "code sharing", "codespace", "programming", "developer tools", "codespace yardansh"],
  verification: {
    google: "h75wZ6VzLYZfGhIiDkfQekWaBwC6s19N1NHynZNOgg4",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "CodeSpace",
    description: "A code snippet sharing platform",
    url: "https://codespace.yardansh.com",
    siteName: "CodeSpace",
    images: [
      {
        url: "https://cloud.yardansh.com/iwuopD.png",
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
    description: "A code snippet sharing platform",
    images: ["https://cloud.yardansh.com/iwuopD.png"],
  },
  icons: {
    icon: [
      { url: "https://cloud.yardansh.com/8MCWUj.png", sizes: "512x512", type: "image/png" },
      { url: "https://cloud.yardansh.com/4DFPLf.png", sizes: "16x16", type: "image/png" },
      { url: "https://cloud.yardansh.com/qdmgQP.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "https://cloud.yardansh.com/x1WVKi.png", sizes: "180x180" },
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
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
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `
(function () {
  var ALL = ['eq','sort','funnel','plus','trash','play','eye','pencil','upload','arrowup','chat','spin','pop','bounce','users','trend'];

  function getAnim(btn) {
    var label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent || '').toLowerCase().trim();
    var svg   = btn.querySelector('svg');

    // --- label-based detection (most reliable) ---
    if (/filter by author/.test(label))                               return 'eq';
    if (/sort/.test(label))                                           return 'sort';
    if (/filter by category/.test(label))                             return 'funnel';
    if (/create new snippet|post a snippet/.test(label))             return 'plus';
    if (/delete|trash|remove/.test(label))                           return 'trash';
    if (/run|play|execute/.test(label))                              return 'play';
    if (/view|eye|preview/.test(label))                              return 'eye';
    if (/edit|rename/.test(label))                                   return 'pencil';
    if (/upload/.test(label))                                        return 'upload';
    if (/scroll to top|back to top/.test(label))                     return 'arrowup';
    if (/feedback|send feedback|chat/.test(label))                   return 'chat';
    if (/trending/.test(label))                                      return 'trend';
    if (/manage users|register.*user|user/.test(label))              return 'users';
    if (/dark|light|theme|mode|switch/.test(label))                  return 'spin';
    if (/save|copy|copied|download/.test(label))                     return 'pop';
    if (/back|previous|return/.test(label))                          return 'arrowup';

    // --- SVG shape-based fallback ---
    if (svg) {
      var lines    = svg.querySelectorAll('line').length;
      var polygons = svg.querySelectorAll('polygon').length;
      var polylines = svg.querySelectorAll('polyline').length;
      var circles  = svg.querySelectorAll('circle').length;

      if (lines >= 9)  return 'eq';        // filter by author
      if (lines === 3 && polygons === 0) return 'sort'; // sort button
      if (polygons > 0) return 'funnel';   // category filter
      if (lines === 2 && polylines === 0)  return 'plus'; // + button
      if (circles > 0 && polylines > 0)   return 'eye';  // eye icon
      if (circles > 0)                    return 'users';
    }

    return 'bounce';
  }

  document.addEventListener('mousedown', function (e) {
    var btn = e.target.closest('button, a[href]');
    if (!btn) return;
    if (!btn.querySelector('svg')) return;

    var anim = getAnim(btn);
    var cls  = 'svg-anim-' + anim;

    ALL.forEach(function(a) { btn.classList.remove('svg-anim-' + a); });
    void btn.offsetWidth;
    btn.classList.add(cls);

    setTimeout(function () { btn.classList.remove(cls); }, 1200);
  }, true);
})();
        ` }} />
      </body>
    </html>
  );
}