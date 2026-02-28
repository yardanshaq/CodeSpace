/**
 * Chromium + Puppeteer helper untuk Vercel
 *
 * Di production (Vercel): pakai @sparticuz/chromium — chromium yang dikompres khusus untuk serverless
 * Di development (lokal): pakai chromium bawaan puppeteer
 *
 * Cara install chromium lokal untuk dev:
 *   npx puppeteer browsers install chrome
 *
 * Cara pakai di snippet (HANYA di API route/server-side):
 *   const { getBrowser, closeBrowser } = require('@/lib/chromium')
 *   const browser = await getBrowser()
 *   const page = await browser.newPage()
 *   await page.goto('https://example.com')
 *   const content = await page.content()
 *   await closeBrowser(browser)
 */

import puppeteer, { Browser, PuppeteerLaunchOptions } from "puppeteer-core";

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  // Reuse browser instance jika masih hidup (dalam satu request lifecycle)
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }

  let launchOptions: PuppeteerLaunchOptions;

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    // ── VERCEL / PRODUCTION ──
    // @sparticuz/chromium menyediakan binary chromium yang dikompres (~40MB)
    // dan di-extract ke /tmp saat runtime
    const chromium = require("@sparticuz/chromium");

    // Aktifkan graphics untuk screenshot
    chromium.setGraphicsMode = false;

    launchOptions = {
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    };
  } else {
    // ── DEVELOPMENT / LOCAL ──
    // Cari chromium/chrome yang terinstall lokal
    const executablePath =
      process.env.CHROMIUM_PATH || // override via env
      (process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : "/usr/bin/google-chrome-stable");

    launchOptions = {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
      executablePath,
      headless: true,
    };
  }

  cachedBrowser = await puppeteer.launch(launchOptions);
  return cachedBrowser;
}

export async function closeBrowser(browser: Browser): Promise<void> {
  if (browser && browser.connected) {
    await browser.close();
    cachedBrowser = null;
  }
}

/**
 * Helper all-in-one: buka halaman, ambil HTML/screenshot, lalu tutup
 * @example
 *   const html = await getPageContent('https://example.com')
 *   const screenshot = await getPageScreenshot('https://example.com')
 */
export async function getPageContent(
  url: string,
  options: {
    waitFor?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
    userAgent?: string;
    extraHeaders?: Record<string, string>;
  } = {}
): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    if (options.userAgent) await page.setUserAgent(options.userAgent);
    if (options.extraHeaders) await page.setExtraHTTPHeaders(options.extraHeaders);

    await page.goto(url, {
      waitUntil: options.waitFor ?? "networkidle2",
      timeout: options.timeout ?? 30000,
    });

    return await page.content();
  } finally {
    await page.close();
    await closeBrowser(browser);
  }
}

export async function getPageScreenshot(
  url: string,
  options: {
    fullPage?: boolean;
    waitFor?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
  } = {}
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: options.waitFor ?? "networkidle2",
      timeout: options.timeout ?? 30000,
    });

    return (await page.screenshot({
      fullPage: options.fullPage ?? false,
      type: "png",
    })) as Buffer;
  } finally {
    await page.close();
    await closeBrowser(browser);
  }
}
