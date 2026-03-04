import { NextRequest, NextResponse } from "next/server";
import vm from "vm";
import path from "path";
import os from "os";
import fs from "fs";
import { createRequire } from "module";
import { prisma } from "@/lib/prisma";

export const maxDuration = 200;
export const dynamic = "force-dynamic";

// Daftar semua module yang tersedia untuk dipakai di dalam snippet.
// Setiap entry di-require saat server pertama kali start (lazy init).
// Jika module gagal di-require, nilainya null dan akan throw error saat diakses snippet.
// Catatan: `moment` dihapus karena sudah deprecated — gunakan `dayjs` sebagai gantinya.
const MODULE_MAP: Record<string, unknown> = {
  "axios": (() => { try { return require("axios"); } catch { return null; } })(),
  "node-fetch": (() => { try { return require("node-fetch"); } catch { return null; } })(),
  "got": (() => { try { return require("got"); } catch { return null; } })(),
  "superagent": (() => { try { return require("superagent"); } catch { return null; } })(),
  "cross-fetch": (() => { try { return require("cross-fetch"); } catch { return null; } })(),
  "form-data": (() => { try { return require("form-data"); } catch { return null; } })(),
  "tough-cookie": (() => { try { return require("tough-cookie"); } catch { return null; } })(),
  "axios-cookiejar-support": (() => { try { return require("axios-cookiejar-support"); } catch { return null; } })(),
  "https-proxy-agent": (() => { try { return require("https-proxy-agent"); } catch { return null; } })(),
  "socks-proxy-agent": (() => { try { return require("socks-proxy-agent"); } catch { return null; } })(),
  "http-proxy-agent": (() => { try { return require("http-proxy-agent"); } catch { return null; } })(),
  "cheerio": (() => { try { return require("cheerio"); } catch { return null; } })(),
  "node-html-parser": (() => { try { return require("node-html-parser"); } catch { return null; } })(),
  "htmlparser2": (() => { try { return require("htmlparser2"); } catch { return null; } })(),
  "jsdom": (() => { try { return require("jsdom"); } catch { return null; } })(),
  "xml2js": (() => { try { return require("xml2js"); } catch { return null; } })(),
  "fast-xml-parser": (() => { try { return require("fast-xml-parser"); } catch { return null; } })(),
  "html-entities": (() => { try { return require("html-entities"); } catch { return null; } })(),
  "html-to-text": (() => { try { return require("html-to-text"); } catch { return null; } })(),
  "puppeteer-core": (() => { try { return require("puppeteer-core"); } catch { return null; } })(),
  "@sparticuz/chromium": (() => { try { return require("@sparticuz/chromium"); } catch { return null; } })(),
  "zencf": (() => { try { return require("zencf"); } catch { return null; } })(),
  "cloudscraper": (() => { try { return require("cloudscraper"); } catch { return null; } })(),
  "@upstash/redis": (() => { try { return require("@upstash/redis"); } catch { return null; } })(),
  "p-limit": (() => { try { return require("p-limit"); } catch { return null; } })(),
  "p-retry": (() => { try { return require("p-retry"); } catch { return null; } })(),
  "p-queue": (() => { try { return require("p-queue"); } catch { return null; } })(),
  "p-map": (() => { try { return require("p-map"); } catch { return null; } })(),
  "bottleneck": (() => { try { return require("bottleneck"); } catch { return null; } })(),
  "async-retry": (() => { try { return require("async-retry"); } catch { return null; } })(),
  "delay": (() => { try { return require("delay"); } catch { return null; } })(),
  "lodash": (() => { try { return require("lodash"); } catch { return null; } })(),
  "dayjs": (() => { try { return require("dayjs"); } catch { return null; } })(),
  "uuid": (() => { try { return require("uuid"); } catch { return null; } })(),
  "nanoid": (() => { try { return require("nanoid"); } catch { return null; } })(),
  "crypto-js": (() => { try { return require("crypto-js"); } catch { return null; } })(),
  "qs": (() => { try { return require("qs"); } catch { return null; } })(),
  "bcryptjs": (() => { try { return require("bcryptjs"); } catch { return null; } })(),
  "jose": (() => { try { return require("jose"); } catch { return null; } })(),
  "jsonwebtoken": (() => { try { return require("jsonwebtoken"); } catch { return null; } })(),
  "user-agents": (() => { try { return require("user-agents"); } catch { return null; } })(),
  "random-useragent": (() => { try { return require("random-useragent"); } catch { return null; } })(),
  "fs-extra": (() => { try { return require("fs-extra"); } catch { return null; } })(),
  "mime-types": (() => { try { return require("mime-types"); } catch { return null; } })(),
  "file-type": (() => { try { return require("file-type"); } catch { return null; } })(),
  "archiver": (() => { try { return require("archiver"); } catch { return null; } })(),
  "adm-zip": (() => { try { return require("adm-zip"); } catch { return null; } })(),
  "sharp": (() => { try { return require("sharp"); } catch { return null; } })(),
  "turndown": (() => { try { return require("turndown"); } catch { return null; } })(),
  "marked": (() => { try { return require("marked"); } catch { return null; } })(),
  "csv-parse": (() => { try { return require("csv-parse"); } catch { return null; } })(),
  "csv-stringify": (() => { try { return require("csv-stringify"); } catch { return null; } })(),
  "xlsx": (() => { try { return require("xlsx"); } catch { return null; } })(),
  "json5": (() => { try { return require("json5"); } catch { return null; } })(),
  "ws": (() => { try { return require("ws"); } catch { return null; } })(),
  "eventsource": (() => { try { return require("eventsource"); } catch { return null; } })(),
  // fs dan fs/promises di-inject per-request dengan path restriction (lihat sandboxedFs di bawah)
  // JANGAN ganti ke require("fs") mentah — akan bisa baca seluruh source code server
  "path": require("path"),
  "os": require("os"),
  "crypto": require("crypto"),
  "http": require("http"),
  "https": require("https"),
  "url": require("url"),
  "stream": require("stream"),
  "buffer": require("buffer"),
  "events": require("events"),
  "util": require("util"),
  "querystring": require("querystring"),
  "zlib": require("zlib"),
  "readline": require("readline"),
  "string_decoder": require("string_decoder"),
  "timers": require("timers"),
  "assert": require("assert")
};

// createRequire: pakai path ke file JS agar webpack tidak error
const _requireBase = (typeof __filename !== "undefined" ? __filename : null)
  ?? path.join(process.cwd(), "node_modules", "next", "dist", "server", "app-render", "work-unit-async-storage.external.js");
const projectRequire = createRequire(_requireBase);


// Kumpulkan nilai env sensitif sekali saat server start — bukan per-request
// Dipakai untuk redact output snippet agar env vars tidak bocor ke client
const SENSITIVE_ENV_VALUES = Object.entries(process.env)
  .filter(([key]) => !["NODE_ENV", "TZ", "PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL"].includes(key))
  .map(([, v]) => v)
  .filter((v): v is string => typeof v === "string" && v.length >= 8);

const sanitizeOutput = (text: string): string => {
  let result = text;
  for (const secret of SENSITIVE_ENV_VALUES) {
    if (result.includes(secret)) {
      result = result.split(secret).join("[REDACTED]");
    }
  }
  return result;
};

// Modul yang SELALU diblokir, bahkan kalau ada di MODULE_MAP
const BLOCKED_MODULES = new Set([
  "process",         // bypass sandbox process.env
  "child_process",   // exec command server
  "net",             // TCP connection arbitrary
  "tls",             // SSL intercept
  "dns",             // DNS lookup internal
  "cluster",         // fork process
  "worker_threads",  // thread bypass
  "v8",              // engine internals
  "inspector",       // debugger attach
  "repl",            // REPL access
  "@prisma/client",  // direct DB access
  "dotenv",          // load .env
  "module",          // require internals
  "vm",              // nested vm escape
]);

function realRequire(moduleName: string) {
  // Blokir modul berbahaya — tidak ada pengecualian
  if (BLOCKED_MODULES.has(moduleName)) {
    throw new Error(`Module '${moduleName}' is not allowed in the sandbox.`);
  }

  if (moduleName === "@/lib/redis" || moduleName === "lib/redis") {
    return require("@/lib/redis");
  }
  if (moduleName === "@/lib/chromium" || moduleName === "lib/chromium") {
    return require("@/lib/chromium");
  }
  if (moduleName in MODULE_MAP) {
    if (MODULE_MAP[moduleName] === null) {
      throw new Error(`Module '${moduleName}' is listed but failed to load on this server.`);
    }
    return MODULE_MAP[moduleName];
  }

  // TIDAK ada fallback ke projectRequire atau eval("require")
  // Hanya modul yang ada di MODULE_MAP yang diizinkan
  const availableModules = Object.keys(MODULE_MAP)
    .filter(k => !BLOCKED_MODULES.has(k))
    .join(", ");
  throw new Error(`Cannot find module '${moduleName}'. Available: ${availableModules}.`);
}

function transformImports(src: string): string {
  src = src.replace(
    /^\s*import\s+(\w+)\s+from\s+(['"`])(.*?)\2\s*;?/gm,
    (_, name, __, mod) => `const ${name} = require('${mod}');`
  );
  src = src.replace(
    /^\s*import\s+\{([^}]+)\}\s+from\s+(['"`])(.*?)\2\s*;?/gm,
    (_, names, __, mod) => {
      const bindings = names.split(',').map((n: string) => {
        const [orig, alias] = n.trim().split(/\s+as\s+/);
        return alias ? `${alias.trim()}: ${orig.trim()}` : orig.trim();
      }).join(', ');
      return `const { ${bindings} } = require('${mod}');`;
    }
  );
  src = src.replace(
    /^\s*import\s+\*\s+as\s+(\w+)\s+from\s+(['"`])(.*?)\2\s*;?/gm,
    (_, name, __, mod) => `const ${name} = require('${mod}');`
  );
  src = src.replace(
    /^\s*import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+(['"`])(.*?)\3\s*;?/gm,
    (_, def, names, __, mod) => {
      const bindings = names.split(',').map((n: string) => {
        const [orig, alias] = n.trim().split(/\s+as\s+/);
        return alias ? `${alias.trim()}: ${orig.trim()}` : orig.trim();
      }).join(', ');
      return `const ${def} = require('${mod}');\nconst { ${bindings} } = require('${mod}');`;
    }
  );
  src = src.replace(/^\s*import\s+(['"`])(.*?)\1\s*;?/gm, (_, __, mod) => `require('${mod}');`);
  src = src.replace(/^\s*export\s+default\s+/gm, '');
  src = src.replace(/^\s*export\s+(const|let|var|function|class|async)\s+/gm, '$1 ');
  src = src.replace(/^\s*export\s+\{[^}]*\}\s*;?/gm, '');
  return src;
}

function formatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const msg = err.message ?? "Unknown error";
  let location = "";
  if (err.stack) {
    const lines = err.stack.split("\n");
    for (const line of lines) {
      if (line.includes("snippet.js")) {
        const match = line.match(/snippet\.js:(\d+):(\d+)/);
        if (match) {
          location = ` [line ${parseInt(match[1]) - 3}]`;
        }
        break;
      }
    }
  }
  return `${msg}${location}`;
}

// Buat sandboxed fs yang HANYA bisa akses tempDir
// Semua operasi di luar tempDir akan diblokir
function createSandboxedFs(allowedDir: string) {
  const realFs = require("fs") as typeof import("fs");
  const realFsp = require("fs/promises") as typeof import("fs/promises");

  function assertSafe(targetPath: unknown) {
    if (typeof targetPath !== "string") return;
    const resolved = path.resolve(targetPath);
    const allowedResolved = path.resolve(allowedDir);
    if (!resolved.startsWith(allowedResolved + path.sep) && resolved !== allowedResolved) {
      throw new Error(`Access denied: path '${targetPath}' is outside the allowed directory.`);
    }
  }

  // Wrap semua method fs yang bisa baca/tulis file
  const sandboxFs = {
    readFileSync: (p: any, opts?: any) => { assertSafe(p); return realFs.readFileSync(p, opts); },
    writeFileSync: (p: any, data: any, opts?: any) => { assertSafe(p); return realFs.writeFileSync(p, data, opts as any); },
    appendFileSync: (p: any, data: any, opts?: any) => { assertSafe(p); return realFs.appendFileSync(p, data, opts as any); },
    existsSync: (p: any) => { assertSafe(p); return realFs.existsSync(p); },
    mkdirSync: (p: any, opts?: any) => { assertSafe(p); return realFs.mkdirSync(p, opts); },
    readdirSync: (p: any, opts?: any) => { assertSafe(p); return realFs.readdirSync(p, opts as any); },
    statSync: (p: any, opts?: any) => { assertSafe(p); return realFs.statSync(p, opts as any); },
    unlinkSync: (p: any) => { assertSafe(p); return realFs.unlinkSync(p); },
    renameSync: (oldP: any, newP: any) => { assertSafe(oldP); assertSafe(newP); return realFs.renameSync(oldP, newP); },
    copyFileSync: (src: any, dest: any, flags?: any) => { assertSafe(src); assertSafe(dest); return realFs.copyFileSync(src, dest, flags); },
    createReadStream: (p: any, opts?: any) => { assertSafe(p); return realFs.createReadStream(p, opts); },
    createWriteStream: (p: any, opts?: any) => { assertSafe(p); return realFs.createWriteStream(p, opts); },
    readFile: (p: any, opts: any, cb?: any) => { assertSafe(p); return realFs.readFile(p, opts, cb); },
    writeFile: (p: any, data: any, opts: any, cb?: any) => { assertSafe(p); return realFs.writeFile(p, data, opts, cb); },
    unlink: (p: any, cb: any) => { assertSafe(p); return realFs.unlink(p, cb); },
    mkdir: (p: any, opts: any, cb?: any) => { assertSafe(p); return realFs.mkdir(p, opts as any, cb as any); },
    readdir: (p: any, opts: any, cb?: any) => { assertSafe(p); return realFs.readdir(p, opts as any, cb as any); },
    stat: (p: any, cb: any) => { assertSafe(p); return realFs.stat(p, cb); },
    // Blokir metode yang berpotensi berbahaya
    realpathSync: () => { throw new Error("fs.realpathSync is not allowed in the sandbox."); },
    realpath: () => { throw new Error("fs.realpath is not allowed in the sandbox."); },
    symlinkSync: () => { throw new Error("fs.symlinkSync is not allowed in the sandbox."); },
    symlink: () => { throw new Error("fs.symlink is not allowed in the sandbox."); },
    chmodSync: () => { throw new Error("fs.chmodSync is not allowed in the sandbox."); },
    chownSync: () => { throw new Error("fs.chownSync is not allowed in the sandbox."); },
    watch: () => { throw new Error("fs.watch is not allowed in the sandbox."); },
    watchFile: () => { throw new Error("fs.watchFile is not allowed in the sandbox."); },
    constants: realFs.constants,
    promises: {
      readFile: async (p: any, opts?: any) => { assertSafe(p); return realFsp.readFile(p, opts); },
      writeFile: async (p: any, data: any, opts?: any) => { assertSafe(p); return realFsp.writeFile(p, data, opts as any); },
      appendFile: async (p: any, data: any, opts?: any) => { assertSafe(p); return realFsp.appendFile(p, data, opts as any); },
      unlink: async (p: any) => { assertSafe(p); return realFsp.unlink(p); },
      mkdir: async (p: any, opts?: any) => { assertSafe(p); return realFsp.mkdir(p, opts); },
      readdir: async (p: any, opts?: any) => { assertSafe(p); return realFsp.readdir(p, opts as any); },
      stat: async (p: any, opts?: any) => { assertSafe(p); return realFsp.stat(p, opts as any); },
      rename: async (oldP: any, newP: any) => { assertSafe(oldP); assertSafe(newP); return realFsp.rename(oldP, newP); },
      copyFile: async (src: any, dest: any, flags?: any) => { assertSafe(src); assertSafe(dest); return realFsp.copyFile(src, dest, flags); },
    },
  };

  return { sandboxFs, sandboxFsp: sandboxFs.promises };
}

export async function POST(req: NextRequest) {
  try {
    const { code, snippetId, files } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const encoder = new TextEncoder();

    // Semua eksekusi berjalan di dalam ReadableStream start callback —
    // ini pola yang benar untuk Next.js App Router streaming.
    // Background IIFE tidak reliable karena serverless bisa kill context lebih awal.
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* controller sudah ditutup */ }
        };

        try {
          const tmpDir = os.tmpdir();
          const tempDir = path.join(tmpDir, "temp");
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

          if (snippetId) {
            try {
              const attachments = await prisma.snippetFile.findMany({
                where: { snippetId },
                include: { globalFile: { select: { name: true, data: true } } },
              });
              for (const a of attachments) {
                fs.writeFileSync(path.join(tempDir, path.basename(a.globalFile.name)), a.globalFile.data);
              }
            } catch (e) {
              console.warn("Warning: failed to load snippet attachments:", e);
            }
          }

          if (Array.isArray(files) && files.length > 0) {
            for (const f of files as { name: string; data: string }[]) {
              if (!f.name || !f.data) continue;
              fs.writeFileSync(path.join(tempDir, path.basename(f.name)), Buffer.from(f.data, "base64"));
            }
          }

          const logs: string[] = [];
          const errors: string[] = [];

          const fmtArgs = (args: unknown[]) =>
            args.map((a) =>
              a === null ? "null" :
              a === undefined ? "undefined" :
              typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)
            ).join(" ");

          const fakeConsole = {
            log: (...args: unknown[]) => {
              const text = sanitizeOutput(fmtArgs(args)); logs.push(text);
              sendEvent({ type: "log", text });
            },
            error: (...args: unknown[]) => {
              const text = "[error] " + sanitizeOutput(fmtArgs(args)); errors.push(text);
              sendEvent({ type: "error", text });
            },
            warn: (...args: unknown[]) => {
              const text = "[warn] " + sanitizeOutput(args.map(String).join(" ")); logs.push(text);
              sendEvent({ type: "warn", text });
            },
            info: (...args: unknown[]) => {
              const text = "[info] " + sanitizeOutput(fmtArgs(args)); logs.push(text);
              sendEvent({ type: "log", text });
            },
            dir: (...args: unknown[]) => {
              const text = sanitizeOutput(args.map((a) => JSON.stringify(a, null, 2)).join(" ")); logs.push(text);
              sendEvent({ type: "log", text });
            },
            table: (...args: unknown[]) => {
              const text = sanitizeOutput(args.map((a) => JSON.stringify(a, null, 2)).join(" ")); logs.push(text);
              sendEvent({ type: "log", text });
            },
            debug: (...args: unknown[]) => {
              const text = "[debug] " + sanitizeOutput(args.map(String).join(" ")); logs.push(text);
              sendEvent({ type: "log", text });
            },
          };

          const startTime = Date.now();
          const NativePromise = Promise;

          const { sandboxFs, sandboxFsp } = createSandboxedFs(tempDir);

          const sandboxRequire = (moduleName: string) => {
            if (moduleName === "process") throw new Error("Module \'process\' is not allowed in the sandbox.");
            if (moduleName === "fs") return sandboxFs;
            if (moduleName === "fs/promises") return sandboxFsp;
            if (moduleName === "fs-extra") return sandboxFs;
            if (moduleName === "axios") return realRequire("axios");
            return realRequire(moduleName);
          };

          const SANDBOX_ENV: Record<string, string | undefined> = {
            NODE_ENV: process.env.NODE_ENV,
            TZ: process.env.TZ,
          };

          // ── SSRF guard ─────────────────────────────────────────────────────────
          // Didefinisikan di luar sandbox object agar tidak merusak syntax object literal.
          // Memblokir fetch() ke IP internal/metadata sebelum request keluar ke jaringan.
          const isBlockedUrl = (input: unknown): boolean => {
            try {
              const url = new URL(String(input));
              const host = url.hostname.toLowerCase();
              if (
                host === "169.254.169.254" ||           // AWS/GCP/Azure IMDS
                host === "metadata.google.internal" ||
                host === "instance-data" ||
                /^127\./.test(host) ||                 // loopback
                host === "localhost" ||
                /^10\./.test(host) ||                  // RFC-1918 Class A
                /^192\.168\./.test(host) ||            // RFC-1918 Class C
                /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) || // RFC-1918 Class B
                host === "0.0.0.0" ||
                host.endsWith(".local") ||
                host.endsWith(".internal")
              ) return true;
            } catch { /* URL parse gagal — biarkan fetch() yang tangani sendiri */ }
            return false;
          };
          // ───────────────────────────────────────────────────────────────────────

          const sandbox: Record<string, unknown> = {
            console: fakeConsole,
            require: sandboxRequire,
            process: {
              env: SANDBOX_ENV,
              argv: [],
              version: process.version,
              platform: process.platform,
              cwd: () => "/sandbox",
              exit: (c?: number) => { logs.push(`[process.exit(${c ?? 0}) called]`); throw new Error("__EXIT__"); },
              stdout: { write: (s: string) => { const t = sanitizeOutput(s); logs.push(t); sendEvent({ type: "log", text: t }); return true; } },
              stderr: { write: (s: string) => { const t = sanitizeOutput(s); errors.push(t); sendEvent({ type: "error", text: t }); return true; } },
              nextTick: (fn: () => void) => NativePromise.resolve().then(fn),
            },
            Buffer, URL, URLSearchParams, TextEncoder, TextDecoder,
            ReadableStream, WritableStream, TransformStream,
            AbortController, AbortSignal, Promise,
            setTimeout, clearTimeout, setInterval, clearInterval,
            setImmediate, clearImmediate, queueMicrotask,
            fetch: async (input: any, init?: any): Promise<Response> => {
              if (isBlockedUrl(input)) {
                throw new Error("fetch blocked: requests to internal/metadata addresses are not allowed.");
              }
              // Native ReadableStream dari host context tidak bisa di-iterate
              // dari dalam VM sandbox (cross-context boundary).
              // Solusi: pipe lewat TransformStream baru yang dibuat di context yang sama
              // dengan sandbox, sehingga res.body bisa dipakai normal (for await, getReader, dll)
              const nativeRes = await globalThis.fetch(input, init);
              const { readable, writable } = new TransformStream();
              const writer = writable.getWriter();
              const nativeReader = nativeRes.body?.getReader();
              if (!nativeReader) {
                writer.close();
              } else {
                (async () => {
                  try {
                    while (true) {
                      const { done, value } = await nativeReader.read();
                      if (done) { writer.close(); break; }
                      await writer.write(new Uint8Array(value));
                    }
                  } catch (e) { writer.abort(e); }
                })();
              }
              return new Response(readable, {
                status : nativeRes.status,
                headers: nativeRes.headers,
              });
            },
            JSON, Math, Date, Error, TypeError, RangeError,
            SyntaxError, ReferenceError, EvalError, URIError,
            parseInt, parseFloat, isNaN, isFinite,
            Number, String, Boolean, Array, Object, Symbol, BigInt,
            Map, Set, WeakMap, WeakSet, Proxy, Reflect, RegExp,
            encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
            atob: (s: string) => Buffer.from(s, "base64").toString("utf8"),
            btoa: (s: string) => Buffer.from(s, "utf8").toString("base64"),
            Uint8Array, Int8Array, Uint16Array, Int16Array,
            Uint32Array, Int32Array, Float32Array, Float64Array,
            ArrayBuffer, DataView,
            module: { exports: {} },
            exports: {},
            __dirname: tempDir,
            __filename: path.join(tempDir, "snippet.js"),
            __tmpdir: tempDir,
            __tempdir: tempDir,
            // Blokir eval dan Function constructor — vektor utama escape sandbox
            eval: undefined,
            Function: undefined,
          };
          sandbox.global = sandbox;
          sandbox.globalThis = sandbox;

          Object.defineProperty(sandbox, "constructor", { value: undefined, writable: false, configurable: false });
          Object.freeze(sandbox.process);

          vm.createContext(sandbox);

          const autoAwaitLastCall = (src: string): string => {
            const lines = src.split("\n");
            for (let i = lines.length - 1; i >= 0; i--) {
              const trimmed = lines[i].trim();
              if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
              if (
                /^[A-Za-z_$][\w$.]*\s*\(/.test(trimmed) &&
                !/^(await|return|const|let|var|if|for|while|throw)\b/.test(trimmed)
              ) {
                lines[i] = lines[i].replace(trimmed, `await ${trimmed}`);
              }
              break;
            }
            return lines.join("\n");
          };

          const transformed = transformImports(code);
          const processedCode = autoAwaitLastCall(transformed);

          const wrappedCode = `
(async () => {
  try {
${processedCode}
  } catch (__err) {
    if (__err && __err.message === '__EXIT__') return;
    const msg = __err && __err.message ? __err.message : String(__err);
    let location = '';
    if (__err && __err.stack) {
      const stackLines = __err.stack.split('\\n');
      for (const line of stackLines) {
        if (line.includes('snippet.js')) {
          const match = line.match(/snippet\\.js:(\\d+):(\\d+)/);
          if (match) location = ' [line ' + (parseInt(match[1]) - 3) + ']';
          break;
        }
      }
    }
    console.error('RuntimeError: ' + msg + location);
  }
})();
`;

          const TIMEOUT_MS = 200000;
          const deadline = Date.now() + TIMEOUT_MS;

          try {
            const script = new vm.Script(wrappedCode, { filename: "snippet.js" });
            const result = script.runInContext(sandbox);

            if (result && typeof (result as Promise<unknown>).then === "function") {
              await NativePromise.race([
                result as Promise<unknown>,
                new NativePromise<void>((_, reject) =>
                  setTimeout(() => reject(new Error("Execution timed out after 200 seconds")), deadline - Date.now())
                ),
              ]);
            }

            // Tunggu microtask queue flush dulu sebelum cek output
            await NativePromise.resolve();

            // Kalau sudah ada output dan kode sync, langsung selesai tanpa nunggu lama
            const isAsync = result && typeof (result as Promise<unknown>).then === "function";
            if (!isAsync && (logs.length > 0 || errors.length > 0)) {
              // kode sync sudah selesai — skip polling
            } else {
              // Tunggu sebentar untuk async ops yang masih jalan (setTimeout, dll)
              let lastCount = logs.length + errors.length;
              let stableRounds = 0;
              while (Date.now() < deadline) {
                await new NativePromise<void>(r => setTimeout(r, 20));
                const current = logs.length + errors.length;
                if (current === lastCount) {
                  stableRounds++;
                  if (stableRounds >= 2) break;
                } else {
                  stableRounds = 0;
                  lastCount = current;
                }
              }
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg !== "__EXIT__") {
              const errText = "ExecutionError: " + sanitizeOutput(formatError(e));
              errors.push(errText);
              sendEvent({ type: "error", text: errText });
            }
          }

          const elapsed = Date.now() - startTime;
          if (logs.length === 0 && errors.length === 0) {
            sendEvent({ type: "log", text: "// Code executed successfully with no console output." });
          }
          sendEvent({ type: "done", elapsed, hasError: errors.length > 0 });

        } catch (e: unknown) {
          sendEvent({ type: "error", text: `ServerError: ${e instanceof Error ? e.message : String(e)}` });
          sendEvent({ type: "done", elapsed: 0, hasError: true });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":      "text/event-stream",
        "Cache-Control":     "no-cache, no-transform",
        "Connection":        "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (e: unknown) {
    return NextResponse.json({
      output: `ServerError: ${e instanceof Error ? e.message : String(e)}`,
      elapsed: 0,
      hasError: true,
    }, { status: 500 });
  }
}