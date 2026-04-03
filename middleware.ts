import { NextRequest, NextResponse } from "next/server";

const isDev = process.env.NODE_ENV !== "production";

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

function buildCsp(nonce: string): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://static.cloudflareinsights.com`;

  // ↓ Tambahkan nonce di style-src — unsafe-inline jadi fallback browser lama saja
  const styleSrc = isDev
    ? `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
    : `style-src 'self' 'unsafe-inline' 'nonce-${nonce}' https://fonts.googleapis.com`;

  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: https://cloudflareinsights.com"
    : "connect-src 'self' https://cloudflareinsights.com";

  return [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://cdn.nekohime.site",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// Helper: inject nonce + CSP ke response yang sudah dibuat
function withCsp(res: NextResponse, nonce: string, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce);
  return res;
}

const COOKIE_NAME = "sid";

const SOCIAL_PREVIEW_UA = [
  "telegrambot", "whatsapp", "facebookexternalhit", "twitterbot",
  "linkedinbot", "discordbot", "slackbot", "applebot", "googlebot",
  "bingbot", "rogerbot", "embedly", "pinterest", "vkshare",
];

const SCRAPER_UA = [
  "curl", "wget", "python-requests", "python-httpx", "aiohttp",
  "node-fetch", "got", "axios", "httpie", "insomnia", "postman",
  "go-http-client", "java/", "okhttp", "php", "ruby", "libwww-perl",
];

function isSocialPreviewBot(ua: string): boolean {
  return SOCIAL_PREVIEW_UA.some((bot) => ua.toLowerCase().includes(bot));
}

function isProgrammaticScraper(ua: string): boolean {
  if (!ua || ua.trim() === "") return true;
  const lower = ua.toLowerCase();
  if (SCRAPER_UA.some((bot) => lower.includes(bot))) return true;
  if (!lower.includes("mozilla") && !lower.includes("applewebkit")) return true;
  return false;
}

function hasValidCookieFormat(token: string | undefined): boolean {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Generate nonce di awal — dipakai untuk SEMUA response
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // /login dan /register — lewatkan tanpa redirect, tapi tetap inject CSP
  if (pathname === "/login" || pathname === "/register") {
    return withCsp(NextResponse.next(), nonce, csp);
  }

  // /users — butuh login
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!hasValidCookieFormat(token)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    return withCsp(NextResponse.next(), nonce, csp);
  }

  // /api/admin — semua endpoint admin butuh cookie yang valid
  if (pathname.startsWith("/api/admin")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!hasValidCookieFormat(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return withCsp(NextResponse.next(), nonce, csp);
  }

  // /post dan /settings — butuh login
  if (
    pathname === "/post" || pathname.startsWith("/post/") ||
    pathname === "/settings" || pathname.startsWith("/settings/")
  ) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!hasValidCookieFormat(token)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    return withCsp(NextResponse.next(), nonce, csp);
  }

  // /code?v=xxx — scraper diarahkan ke versi raw, bot preview dibiarkan lewat
  if (pathname === "/code") {
    const id = req.nextUrl.searchParams.get("v");
    if (id) {
      const ua = req.headers.get("user-agent") || "";
      if (isSocialPreviewBot(ua)) return withCsp(NextResponse.next(), nonce, csp);
      if (isProgrammaticScraper(ua)) {
        const rawUrl = req.nextUrl.clone();
        rawUrl.pathname = `/snippet/${id}/raw`;
        rawUrl.search = "";
        return NextResponse.rewrite(rawUrl);
      }
    }
  }

  // /snippet/[id] — scraper juga diarahkan ke versi raw
  const snippetMatch = pathname.match(/^\/snippet\/([^/]+)$/);
  if (snippetMatch) {
    const id = snippetMatch[1];
    const ua = req.headers.get("user-agent") || "";
    if (isSocialPreviewBot(ua)) return withCsp(NextResponse.next(), nonce, csp);
    if (isProgrammaticScraper(ua)) {
      const rawUrl = req.nextUrl.clone();
      rawUrl.pathname = `/snippet/${id}/raw`;
      return NextResponse.rewrite(rawUrl);
    }
  }

  // Default — inject CSP untuk semua request HTML biasa
  return withCsp(NextResponse.next(), nonce, csp);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)).*)",
  ],
};