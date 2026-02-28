/** @type {import('next').NextConfig} */

// Daftar package yang dijalankan di luar bundler Next.js (server-side only).
// Ini perlu karena package-package ini tidak bisa di-bundle oleh webpack
// (biasanya karena punya native addon atau ESM-only di environment tertentu).
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

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: RUN_ROUTE_EXTERNALS,
    serverActions: {
      // Tambahkan domain production kamu di sini jika sudah di-deploy
      allowedOrigins: ["localhost:3000"],
      bodySizeLimit: "10mb",
    },
  },

  // Security headers untuk semua response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Cegah halaman dimuat dalam iframe dari domain lain (clickjacking)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Cegah browser menebak MIME type sendiri
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Matikan referrer untuk request ke domain lain
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Batasi akses ke fitur browser yang sensitif
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Paksa HTTPS di production (30 hari)
          { key: "Strict-Transport-Security", value: "max-age=2592000; includeSubDomains" },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ...RUN_ROUTE_EXTERNALS,
        // Native / binary packages
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
    return config;
  },
};

module.exports = nextConfig;