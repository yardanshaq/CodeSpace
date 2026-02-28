import { NextRequest, NextResponse } from "next/server";

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login", "/register",
    "/users", "/users/:path*",
    "/api/admin/:path*",
    "/post", "/post/:path*",
    "/settings", "/settings/:path*",
    "/code", "/snippet/:id*",
  ],
};