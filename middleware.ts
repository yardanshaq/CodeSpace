import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const isDev = process.env.NODE_ENV !== "production";

function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

function buildCsp(nonce: string): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://static.cloudflareinsights.com`;

  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: https://cloudflareinsights.com"
    : "connect-src 'self' https://cloudflareinsights.com";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://cdn.nekohime.site",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
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

  // /login dan /register — JANGAN redirect hanya berdasarkan format cookie.
  // Session bisa saja sudah expired di DB meski cookie-nya masih ada dan valid formatnya.
  // Biarkan login page yang handle redirect (via /api/auth/me check di client),
  // sehingga cookie stale bisa otomatis di-clear tanpa perlu hapus manual.
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.next();
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
    return NextResponse.next();
  }

  // /api/admin — semua endpoint admin butuh cookie yang valid
  if (pathname.startsWith("/api/admin")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!hasValidCookieFormat(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
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
    return NextResponse.next();
  }

  // /code?v=xxx — scraper diarahkan ke versi raw, bot preview dibiarkan lewat
  if (pathname === "/code") {
    const id = req.nextUrl.searchParams.get("v");
    if (id) {
      const ua = req.headers.get("user-agent") || "";
      if (isSocialPreviewBot(ua)) return NextResponse.next();
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
    if (isSocialPreviewBot(ua)) return NextResponse.next();
    if (isProgrammaticScraper(ua)) {
      const rawUrl = req.nextUrl.clone();
      rawUrl.pathname = `/snippet/${id}/raw`;
      return NextResponse.rewrite(rawUrl);
    }
  }

  // Generate nonce untuk semua request HTML biasa — inject CSP per-request
  const nonce = generateNonce();
  const csp   = buildCsp(nonce);
  const res   = NextResponse.next();
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce); // dibaca oleh layout.tsx untuk <Script nonce>
  return res;
}

export const config = {
  matcher: [
    // Exclude static files & internal Next.js routes dari nonce injection
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)).*)",
  ],
};