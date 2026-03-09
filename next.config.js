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

const buildCsp = () => {
  // Dev mode butuh 'unsafe-eval' untuk Next.js HMR source maps
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com"
    : "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com";

  // Dev butuh ws:// untuk webpack HMR websocket
  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: https://cloudflareinsights.com"
    : "connect-src 'self' https://cloudflareinsights.com";

  return [
    "default-src 'self'",
    scriptSrc,
    // Google Fonts CSS + font files (dipakai di globals.css)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Favicon & OG image dari CDN
    "img-src 'self' data: https://cdn.nekohime.site",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
};

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: RUN_ROUTE_EXTERNALS,
    serverActions: {
      allowedOrigins: ["localhost:3000"],
      bodySizeLimit: "10mb",
    },
  },

  async headers() {
    const csp = buildCsp();

    return [
      {
        source: "/(.*)",
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
          { key: "Cache-Control",                 value: "no-store, max-age=0" },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ...RUN_ROUTE_EXTERNALS,
        "puppeteer-core",
        "@sparticuz/chromium",
        "sharp",
        "bcrypt",
        "canvas",
        "bufferutil",
        "utf-8-validate",
        "zencf",
      ];
    }

    // Suppress "module.createRequire failed parsing argument" warning
    // that comes from __filename usage in app/api/run/route.ts.
    // We tell webpack to ignore the 'module' built-in — it's only used
    // at runtime in Node.js, not needed at bundle time.
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      module: false,
    };

    return config;
  },
};

module.exports = nextConfig;