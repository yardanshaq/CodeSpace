import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_START_KEY = "codespace:server_start";
const REQ_COUNTER_KEY  = "codespace:req_counter";

// Simpan waktu start ke Redis saat pertama kali — persist across workers
async function getOrSetStartTime(): Promise<number> {
  const existing = await redis.get<number>(SERVER_START_KEY);
  if (existing) return existing;
  const now = Date.now();
  await redis.set(SERVER_START_KEY, now); // tanpa expire — permanen
  return now;
}

export async function GET() {
  try {
    // Increment request counter di Redis (atomic)
    const reqCount = await redis.incr(REQ_COUNTER_KEY);

    const pingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - pingStart;

    const [startTime, snippetCount, userCount, totalViews, totalLikes, totalComments, recentSnippets] =
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
      ]);

    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Reset counter setelah dibaca (untuk requestDelta per 30s)
    await redis.set(REQ_COUNTER_KEY, 0);

    const mem     = process.memoryUsage();
    const total   = os.totalmem();
    const free    = os.freemem();
    const cpus    = os.cpus();
    const loadAvg = os.loadavg();

    return NextResponse.json({
      snippets:     snippetCount,
      users:        userCount,
      views:        totalViews._sum.views ?? 0,
      likes:        totalLikes,
      comments:     totalComments,
      dbLatency,
      requestDelta: reqCount,
      recentSnippets,
      uptime:       uptimeSeconds,
      timestamp:    new Date().toISOString(),
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
        region:      process.env.VERCEL_REGION ?? "local",
        nodeVersion: process.version,
        platform:    process.platform,
      },
    }, {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag":  "noindex",
      },
    });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}