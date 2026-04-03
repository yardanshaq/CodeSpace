import { NextRequest, NextResponse } from "next/server";

// Cek apakah web jalan di domain utama (True Production) atau di mode Preview/Dev
const isTrueProd = process.env.VERCEL_ENV === "production" || 
                  (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

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
  // 1. TRUE PRODUCTION: CSP Super Ketat untuk skor 15/15.
  if (isTrueProd) {
    return [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://static.cloudflareinsights.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://cdn.nekohime.site",
      "connect-src 'self' https://cloudflareinsights.com",
      "frame-src 'self'",
      "child-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
  }

  // 2. PREVIEW / DEV: Dilonggarkan sedikit agar Vercel Toolbar & HMR Next.js tidak error.
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://vercel.live`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://cdn.nekohime.site",
    "connect-src 'self' ws: wss: https://cloudflareinsights.com https://vercel.live",
    "frame-src 'self' https://vercel.live",
    "child-src 'self' https://vercel.live",
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
  const ua = req.headers.get("user-agent") || "";
  
  // TAMPUNG DULU! Jangan return secara prematur
  let res = NextResponse.next();

  // 1. Scraper & Raw Code Routing
  if (pathname === "/code") {
    const id = req.nextUrl.searchParams.get("v");
    if (id && !isSocialPreviewBot(ua) && isProgrammaticScraper(ua)) {
      const rawUrl = req.nextUrl.clone();
      rawUrl.pathname = `/snippet/${id}/raw`;
      rawUrl.search = "";
      res = NextResponse.rewrite(rawUrl);
    }
  } else {
    const snippetMatch = pathname.match(/^\/snippet\/([^/]+)$/);
    if (snippetMatch) {
      const id = snippetMatch[1];
      if (!isSocialPreviewBot(ua) && isProgrammaticScraper(ua)) {
        const rawUrl = req.nextUrl.clone();
        rawUrl.pathname = `/snippet/${id}/raw`;
        res = NextResponse.rewrite(rawUrl);
      }
    }
  }

  // 2. Auth Checking
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!hasValidCookieFormat(token)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      res = NextResponse.redirect(url);
    }
  } else if (pathname.startsWith("/api/admin")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!hasValidCookieFormat(token)) {
      // Khusus endpoint API, boleh langsung return JSON
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); 
    }
  } else if (
    pathname === "/post" || pathname.startsWith("/post/") ||
    pathname === "/settings" || pathname.startsWith("/settings/")
  ) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!hasValidCookieFormat(token)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      res = NextResponse.redirect(url);
    }
  }

  // 3. Eksekusi Injeksi CSP (Termasuk untuk /login dan /register)
  if (res.status !== 401) {
    const nonce = generateNonce();
    const csp = buildCsp(nonce);
    res.headers.set("Content-Security-Policy", csp);
    res.headers.set("x-nonce", nonce);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)).*)",
  ],
};