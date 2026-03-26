import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getSession } from "@/lib/auth";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_START_KEY = "codespace:server_start";
const REQ_COUNTER_KEY  = "codespace:req_counter";

async function getOrSetStartTime(): Promise<number> {
  const existing = await redis.get<number>(SERVER_START_KEY);
  if (existing) return existing;
  const now = Date.now();
  await redis.set(SERVER_START_KEY, now);
  return now;
}

let cachedRegion: string | null = null;
async function fetchRegionFromIP(): Promise<string> {
  if (cachedRegion) return cachedRegion;
  if (process.env.VERCEL_REGION)  { cachedRegion = process.env.VERCEL_REGION;  return cachedRegion; }
  if (process.env.RAILWAY_REGION) { cachedRegion = process.env.RAILWAY_REGION; return cachedRegion; }
  if (process.env.RENDER_REGION)  { cachedRegion = process.env.RENDER_REGION;  return cachedRegion; }
  if (process.env.FLY_REGION)     { cachedRegion = process.env.FLY_REGION;     return cachedRegion; }
  if (process.env.SERVER_REGION)  { cachedRegion = process.env.SERVER_REGION;  return cachedRegion; }

  try {
    const FIELDS = "status,message,country,countryCode,regionName,city,timezone,isp,org,query";
    const r = await fetch(`http://ip-api.com/json/?fields=${FIELDS}`, { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (d.status === "success" && d.city && d.regionName && d.country) {
      cachedRegion = `${d.city}, ${d.regionName}, ${d.country}`;
      return cachedRegion;
    }
  } catch { /* fallback */ }

  cachedRegion = `${os.hostname()} (${process.platform})`;
  return cachedRegion;
}

export async function GET() {
  try {
    const session = await getSession();
    const isSuperAdmin = session?.role === "SUPERADMIN";

    const reqCount = await redis.incr(REQ_COUNTER_KEY);

    const pingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - pingStart;

    const [startTime, snippetCount, userCount, totalViews, totalLikes, totalComments, recentSnippets, regionLabel] =
      await Promise.all([
        getOrSetStartTime(),
        prisma.snippet.count({ where: { isPublic: true } }),
        prisma.admin.count(),
        prisma.snippet.aggregate({ _sum: { views: true } }),
        prisma.like.count(),
        prisma.comment.count(),
        prisma.snippet.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, category: true, createdAt: true, views: true, filename: true },
          where: { isPublic: true },
        }),
        fetchRegionFromIP(),
      ]);

    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    await redis.set(REQ_COUNTER_KEY, 0);

    // ── Public stats (safe for everyone) ─────────────────────────────────────
    const publicStats = {
      snippets:      snippetCount,
      users:         userCount,
      views:         totalViews._sum.views ?? 0,
      likes:         totalLikes,
      comments:      totalComments,
      recentSnippets,
      timestamp:     new Date().toISOString(),
    };

    // ── Privileged stats (superadmin only) ───────────────────────────────────
    // Hardware details, memory, CPU, node version, uptime, and region expose
    // server fingerprinting data that could aid targeted attacks.
    if (isSuperAdmin) {
      const mem     = process.memoryUsage();
      const total   = os.totalmem();
      const free    = os.freemem();
      const cpus    = os.cpus();
      const loadAvg = os.loadavg();

      return NextResponse.json({
        ...publicStats,
        dbLatency,
        requestDelta: reqCount,
        uptime: uptimeSeconds,
        hardware: {
          cpu:         cpus[0]?.model ?? "Unknown",
          cpuCores:    cpus.length,
          totalMem:    total,
          usedMem:     total - free,
          heapUsed:    mem.heapUsed,
          heapTotal:   mem.heapTotal,
          rss:         mem.rss,
          loadAvg1:    loadAvg[0],
          loadAvg5:    loadAvg[1],
          region:      regionLabel,
          nodeVersion: process.version,
          platform:    process.platform,
        },
      }, {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag":  "noindex",
        },
      });
    }

    return NextResponse.json(publicStats, {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag":  "noindex",
      },
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}