import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import os from "os";

export const runtime = "nodejs";

export async function GET() {
  try {
    const start = Date.now();

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
          select: { id: true, title: true, category: true, createdAt: true, views: true },
          where: { isPublic: true },
        }),
      ]);

    const dbLatency = Date.now() - start;
    const mem       = process.memoryUsage();
    const totalMem  = os.totalmem();
    const freeMem   = os.freemem();
    const cpus      = os.cpus();
    const loadAvg   = os.loadavg();

    return NextResponse.json({
      snippets:       snippetCount,
      users:          userCount,
      views:          totalViews._sum.views ?? 0,
      likes:          totalLikes,
      comments:       totalComments,
      dbLatency,
      recentSnippets,
      uptime:         process.uptime(),
      timestamp:      new Date().toISOString(),
      hardware: {
        cpu:          cpus[0]?.model ?? "Unknown",
        cpuCores:     cpus.length,
        totalMem:     totalMem,
        usedMem:      totalMem - freeMem,
        heapUsed:     mem.heapUsed,
        heapTotal:    mem.heapTotal,
        rss:          mem.rss,
        loadAvg1:     loadAvg[0],
        loadAvg5:     loadAvg[1],
        region:       process.env.VERCEL_REGION ?? process.env.REGION ?? "local",
        nodeVersion:  process.version,
        platform:     process.platform,
      },
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}