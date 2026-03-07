import { NextRequest, NextResponse } from "next/server";
import vm from "vm";
import path from "path";
import os from "os";
import fs from "fs";
import { createRequire } from "module";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export const maxDuration = 200;
export const dynamic = "force-dynamic";

// List of all modules available for use inside snippets.
// Each entry is required when the server first starts (lazy init).
// If a module fails to load, its value is null and will throw when accessed by a snippet.
// Note: `moment` removed as deprecated — use `dayjs` instead.
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
  // fs and fs/promises are injected per-request with path restriction (see sandboxedFs below)
  // DO NOT replace with raw require('fs') — that would expose the entire server source
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

// createRequire: use a JS file path so webpack does not error
const _requireBase = (typeof __filename !== "undefined" ? __filename : null)
  ?? path.join(process.cwd(), "node_modules", "next", "dist", "server", "app-render", "work-unit-async-storage.external.js");
const projectRequire = createRequire(_requireBase);


// Collect sensitive env values once at server start — not per-request
// Used to redact snippet output so env vars do not leak to the client
const SENSITIVE_ENV_VALUES = Object.entries(process.env)
  .filter(([key]) => !["NODE_ENV", "TZ", "PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL"].includes(key))
  .map(([, v]) => v)
  .filter((v): v is string =>
    typeof v === "string" &&
    v.length >= 8 &&
    // Exclude path-like values — not secrets, would cause false redaction of file paths in error messages
    !v.includes("/") &&
    !v.includes("\\"));

const sanitizeOutput = (text: string): string => {
  let result = text;
  for (const secret of SENSITIVE_ENV_VALUES) {
    if (result.includes(secret)) {
      result = result.split(secret).join("[REDACTED]");
    }
  }
  return result;
};

// Modules that are ALWAYS blocked, even if present in MODULE_MAP
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
  // Block dangerous modules — no exceptions
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

  // NO fallback to projectRequire or eval("require")
  // Only modules listed in MODULE_MAP are allowed
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

// Create a sandboxed fs that can ONLY access tempDir
// All operations outside tempDir are blocked
function createSandboxedFs(allowedDir: string) {
  const realFs = require("fs") as typeof import("fs");
  const realFsp = require("fs/promises") as typeof import("fs/promises");

  function resolveSafe(targetPath: unknown): string {
    if (typeof targetPath !== "string") return targetPath as string;
    // Resolve relative paths against allowedDir, not server cwd
    // so fs.readFileSync('watermark.jpg') works correctly inside snippets
    const resolved = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(allowedDir, targetPath);
    const allowedResolved = path.resolve(allowedDir);
    if (!resolved.startsWith(allowedResolved + path.sep) && resolved !== allowedResolved) {
      throw new Error(`Access denied: path '${targetPath}' is outside the allowed directory.`);
    }
    return resolved;
  }

  // Keep assertSafe as a void-returning alias for backward compat in mkdir/readdir etc
  const assertSafe = (p: unknown) => resolveSafe(p);

  // Wrap all fs methods that can read/write files
  const sandboxFs = {
    readFileSync: (p: any, opts?: any) => { return realFs.readFileSync(resolveSafe(p), opts); },
    writeFileSync: (p: any, data: any, opts?: any) => { return realFs.writeFileSync(resolveSafe(p), data, opts as any); },
    appendFileSync: (p: any, data: any, opts?: any) => { return realFs.appendFileSync(resolveSafe(p), data, opts as any); },
    existsSync: (p: any) => { return realFs.existsSync(resolveSafe(p)); },
    mkdirSync: (p: any, opts?: any) => { return realFs.mkdirSync(resolveSafe(p), opts); },
    readdirSync: (p: any, opts?: any) => { return realFs.readdirSync(resolveSafe(p), opts as any); },
    statSync: (p: any, opts?: any) => { return realFs.statSync(resolveSafe(p), opts as any); },
    unlinkSync: (p: any) => { return realFs.unlinkSync(resolveSafe(p)); },
    renameSync: (oldP: any, newP: any) => { return realFs.renameSync(resolveSafe(oldP), resolveSafe(newP)); },
    copyFileSync: (src: any, dest: any, flags?: any) => { return realFs.copyFileSync(resolveSafe(src), resolveSafe(dest), flags); },
    createReadStream: (p: any, opts?: any) => { return realFs.createReadStream(resolveSafe(p), opts); },
    createWriteStream: (p: any, opts?: any) => { return realFs.createWriteStream(resolveSafe(p), opts); },
    readFile: (p: any, opts: any, cb?: any) => { return realFs.readFile(resolveSafe(p), opts, cb); },
    writeFile: (p: any, data: any, opts: any, cb?: any) => { return realFs.writeFile(resolveSafe(p), data, opts, cb); },
    unlink: (p: any, cb: any) => { return realFs.unlink(resolveSafe(p), cb); },
    mkdir: (p: any, opts: any, cb?: any) => { return realFs.mkdir(resolveSafe(p), opts as any, cb as any); },
    readdir: (p: any, opts: any, cb?: any) => { return realFs.readdir(resolveSafe(p), opts as any, cb as any); },
    stat: (p: any, cb: any) => { return realFs.stat(resolveSafe(p), cb); },
    // Block potentially dangerous methods
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
      readFile: async (p: any, opts?: any) => { return realFsp.readFile(resolveSafe(p), opts); },
      writeFile: async (p: any, data: any, opts?: any) => { return realFsp.writeFile(resolveSafe(p), data, opts as any); },
      appendFile: async (p: any, data: any, opts?: any) => { return realFsp.appendFile(resolveSafe(p), data, opts as any); },
      unlink: async (p: any) => { return realFsp.unlink(resolveSafe(p)); },
      mkdir: async (p: any, opts?: any) => { return realFsp.mkdir(resolveSafe(p), opts); },
      readdir: async (p: any, opts?: any) => { return realFsp.readdir(resolveSafe(p), opts as any); },
      stat: async (p: any, opts?: any) => { return realFsp.stat(resolveSafe(p), opts as any); },
      rename: async (oldP: any, newP: any) => { return realFsp.rename(resolveSafe(oldP), resolveSafe(newP)); },
      copyFile: async (src: any, dest: any, flags?: any) => { return realFsp.copyFile(resolveSafe(src), resolveSafe(dest), flags); },
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

    // All execution runs inside the ReadableStream start callback —
    // this is the correct pattern for Next.js App Router streaming.
    // Background IIFEs are unreliable as serverless may kill the context early.
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* controller sudah ditutup */ }
        };

        try {
          const tmpDir = os.tmpdir();
          const tempDir = path.join(tmpDir, "sandbox");
          // Create common subdirs so snippets can use 'file.jpg', 'temp/file.jpg', or 'tmp/file.jpg'
          const tempSubDirs = ["temp", "tmp"].map(d => path.join(tempDir, d));
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          for (const d of tempSubDirs) {
            if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
          }

          if (snippetId) {
            try {
              // snippetId may be a Prisma id or a filename — resolve to the real Prisma id first
              // so the Redis key snippet:files:{id} is always consistent
              let resolvedSnippetId = snippetId;
              const byId = await prisma.snippet.findUnique({ where: { id: snippetId }, select: { id: true } });
              if (!byId) {
                const byFilename = await prisma.snippet.findUnique({ where: { filename: snippetId }, select: { id: true } });
                if (byFilename) resolvedSnippetId = byFilename.id;
              }

              const fileIds = await redis.get<string[]>(`snippet:files:${resolvedSnippetId}`);
              if (Array.isArray(fileIds) && fileIds.length > 0) {
                for (const fileId of fileIds) {
                  const [meta, b64] = await Promise.all([
                    redis.get<{ name: string }>(`file:meta:${fileId}`),
                    redis.get<string>(`file:data:${fileId}`),
                  ]);
                  if (meta && b64) {
                    const fileBuffer = Buffer.from(b64, "base64");
                    const fileName = path.basename(meta.name);
                    // Write to tempDir root and all common subdirs (temp/, tmp/)
                    // so snippets work regardless of which path they use
                    fs.writeFileSync(path.join(tempDir, fileName), fileBuffer);
                    for (const d of tempSubDirs) {
                      fs.writeFileSync(path.join(d, fileName), fileBuffer);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Warning: failed to load snippet attachments:", e);
            }
          }

          if (Array.isArray(files) && files.length > 0) {
            for (const f of files as { name: string; data: string }[]) {
              if (!f.name || !f.data) continue;
              const inlineBuf = Buffer.from(f.data, "base64");
              const inlineName = path.basename(f.name);
              fs.writeFileSync(path.join(tempDir, inlineName), inlineBuf);
              for (const d of tempSubDirs) {
                fs.writeFileSync(path.join(d, inlineName), inlineBuf);
              }
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

          // ── SSRF guard ──────────────────────────────────────────────────────────
          // Defined outside the sandbox object to avoid breaking object literal syntax.
          // Blocks fetch() to internal/metadata IPs before the request leaves the network.
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
              cwd: () => tempDir,  // return real tempDir so path.join(process.cwd(), ...) resolves correctly
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
              // Native ReadableStream from the host context cannot be iterated
              // from inside the VM sandbox (cross-context boundary).
              // Fix: pipe through a new TransformStream created in the same context
              // as the sandbox, so res.body works normally (for await, getReader, etc.)
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
            // Block eval and Function constructor — primary sandbox escape vectors
            eval: undefined,
            Function: undefined,
            // Signal injected by runner — called when wrappedCode outer async completes
            __signalDone__: () => {},  // placeholder, replaced below
          };
          sandbox.global = sandbox;
          sandbox.globalThis = sandbox;

          Object.defineProperty(sandbox, "constructor", { value: undefined, writable: false, configurable: false });
          Object.freeze(sandbox.process);

          vm.createContext(sandbox);

          const autoAwaitLastCall = (src: string): string => {
            // First: add await to all un-awaited (async () => { ... })() patterns
            // This ensures top-level async IIFEs (common pattern) are properly awaited
            src = src.replace(
              /(?<!await\s)\(async\s*(?:function\s*\w*)?\s*\(/g,
              "await (async ("
            );

            // Then: add await to the last bare function call if not already awaited
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
  } finally {
    if (typeof __signalDone__ === 'function') __signalDone__();
  }
})();
`;

          const TIMEOUT_MS = 200000;
          const deadline = Date.now() + TIMEOUT_MS;

          // Create a native Promise that resolves when the VM's outer async IIFE completes
          // (including all awaited inner operations like network calls, file writes)
          let __vmDoneResolve__: () => void;
          const __vmDone__ = new NativePromise<void>(r => { __vmDoneResolve__ = r; });
          sandbox.__signalDone__ = __vmDoneResolve__!;

          try {
            const script = new vm.Script(wrappedCode, { filename: "snippet.js" });
            const result = script.runInContext(sandbox);

            // Wait for VM async completion signal (or timeout)
            await NativePromise.race([
              __vmDone__,
              new NativePromise<void>((_, reject) =>
                setTimeout(() => reject(new Error("Execution timed out after 200 seconds")), deadline - Date.now())
              ),
            ]);

            // Wait briefly for any late setTimeout callbacks after async completion
            let lastCount = logs.length + errors.length;
            let lastFileCount = 0;
            let stableRounds = 0;
            while (Date.now() < deadline) {
              await new NativePromise<void>(r => setTimeout(r, 80));
              const current = logs.length + errors.length;
              // Also count new image files as "activity"
              let fileCount = 0;
              try {
                const IMAGE_EXTS_WAIT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]);
                for (const fname of fs.readdirSync(tempDir)) {
                  if (!IMAGE_EXTS_WAIT.has(path.extname(fname).toLowerCase())) continue;
                  try {
                    const st = fs.statSync(path.join(tempDir, fname));
                    if (st.mtimeMs >= startTime) fileCount++;
                  } catch { /* skip */ }
                }
              } catch { /* skip */ }
              if (current === lastCount && fileCount === lastFileCount) {
                stableRounds++;
                if (stableRounds >= 3) break;
              } else {
                stableRounds = 0;
                lastCount = current;
                lastFileCount = fileCount;
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

          // Scan tempDir for image files written during THIS run (mtime >= startTime)
          try {
            const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"]);
            for (const fname of fs.readdirSync(tempDir)) {
              const ext = path.extname(fname).toLowerCase();
              if (!IMAGE_EXTS.has(ext)) continue;
              try {
                const fpath = path.join(tempDir, fname);
                const stat  = fs.statSync(fpath);
                if (stat.mtimeMs < startTime) continue;
                if (stat.size > 10 * 1024 * 1024) continue;
                const buf  = fs.readFileSync(fpath);
                const mime = ext === ".svg" ? "image/svg+xml"
                  : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
                  : ext === ".gif" ? "image/gif"
                  : ext === ".webp" ? "image/webp"
                  : ext === ".bmp" ? "image/bmp"
                  : "image/png";
                sendEvent({ type: "image", name: fname, mime, data: buf.toString("base64") });
              } catch { /* skip unreadable */ }
            }
          } catch { /* skip scan errors */ }

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