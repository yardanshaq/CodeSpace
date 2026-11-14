/** @type {import('next').NextConfig} */

const RUN_ROUTE_EXTERNALS = [
  // HTTP clients
  "axios", "node-fetch", "got", "superagent", "cross-fetch",
  "form-data", "tough-cookie", "axios-cookiejar-support",
  "https-proxy-agent", "socks-proxy-agent", "http-proxy-agent",
  // Parsers
  "cheerio", "node-html-parser", "htmlparser2", "jsdom",
  "xml2js", "fast-xml-parser", "html-entities", "html-to-text",
  // Browser
  "puppeteer-core", "@sparticuz/chromium", "zencf", "cloudscraper",
  // DB / cache
  "@prisma/client", "@upstash/redis",
  // Async utils
  "p-limit", "p-retry", "p-queue", "p-map",
  "bottleneck", "async-retry", "delay",
  // Utils
  "lodash", "dayjs", "uuid", "nanoid",
  "crypto-js", "qs", "bcryptjs", "jose", "jsonwebtoken",
  "dotenv", "user-agents", "random-useragent",
  // File / media
  "fs-extra", "mime-types", "file-type", "archiver", "adm-zip", "sharp",
  // Format
  "turndown", "marked", "csv-parse", "csv-stringify", "xlsx", "json5",
  // Network
  "ws", "eventsource",
];

const isDev = process.env.NODE_ENV !== "production";

const buildCsp = (nonce) => {
  // Dev mode butuh 'unsafe-eval' untuk Next.js HMR source maps
  // Production: pakai nonce supaya tidak perlu 'unsafe-inline'
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com"
    : nonce
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://static.cloudflareinsights.com`
      : "script-src 'self' https://static.cloudflareinsights.com";

  // Dev butuh ws:// untuk HMR websocket
  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: https://cloudflareinsights.com"
    : "connect-src 'self' https://cloudflareinsights.com";

  return [
    "default-src 'self'",
    scriptSrc,
    // Google Fonts CSS + font files (dipakai di globals.css)
    // style-src tetap butuh 'unsafe-inline' untuk inline styles React/Next.js
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Logo lokal dari /public, favicon/OG dari CDN cloud.yardansh.com
    "img-src 'self' data: blob: https://cloud.yardansh.com",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
};

const nextConfig = {
  // Next 16: paket server-only dipisah dari bundle otomatis (pengganti
  // experimental.serverComponentsExternalPackages + webpack externals).
  serverExternalPackages: RUN_ROUTE_EXTERNALS,

  async headers() {
    // Nonce untuk static headers tidak bisa di-generate per-request di sini.
    // CSP dengan nonce di-inject oleh proxy.ts per request.
    // File ini hanya sebagai fallback kalau proxy tidak jalan (mis. static export).
    const csp = buildCsp();

    return [
      {
        // Security headers untuk semua request. Cache-Control sengaja TIDAK
        // di-set di sini: header no-store global sebelumnya mematikan cache
        // untuk /_next/static/* sehingga setiap navigasi mengunduh ulang
        // semua chunk JS/CSS.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy",  value: csp },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy",  value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "unsafe-none" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        // Immutable cache untuk aset statis ber-hash dari Next.js.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // File di /public (logo, robots.txt) — cache 1 hari, revalidate.
        source: "/:file(logo\\.png|robots\\.txt)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

module.exports = nextConfig;
