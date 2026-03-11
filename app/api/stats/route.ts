import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import os from "os";

export const runtime = "nodejs";

// globalThis persist selama process hidup — tidak reset tiap request
const g = globalThis as { _serverStart?: number; _reqCounter?: number };
if (!g._serverStart)  g._serverStart  = Date.now();
if (!g._reqCounter)   g._reqCounter   = 0;

function drainRequestCount() {
  const c = g._reqCounter ?? 0;
  g._reqCounter = 0;
  return c;
}

export async function GET() {
  g._reqCounter = (g._reqCounter ?? 0) + 1;

  try {
    const pingStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - pingStart;

    const [snippetCount, userCount, totalViews, totalLikes, totalComments, recentSnippets] =
      await Promise.all([
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
      requestDelta: drainRequestCount(),
      recentSnippets,
      // Uptime dihitung dari globalThis — akurat di production
      uptime:       Math.floor((Date.now() - (g._serverStart ?? Date.now())) / 1000),
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