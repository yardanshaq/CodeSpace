import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CACHE_TTL = 3;

function cacheKey(snippetId: string) {
  return `sse:stats:${snippetId}`;
}

async function getStats(snippetId: string) {
  const cached = await redis.get<{
    views: number;
    likeCount: number;
    commentCount: number;
  }>(cacheKey(snippetId));

  if (cached) return cached;

  const [snippet, likeCount, commentCount] = await Promise.all([
    prisma.snippet.findUnique({
      where: { id: snippetId },
      select: { views: true },
    }),
    prisma.like.count({ where: { snippetId } }),
    prisma.comment.count({ where: { snippetId } }),
  ]);

  if (!snippet) return null;

  const stats = {
    views: snippet.views,
    likeCount,
    commentCount,
  };

  await redis.set(cacheKey(snippetId), stats, { ex: CACHE_TTL });

  return stats;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const snippetId = params.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = async () => {
        if (closed) return;
        try {
          const stats = await getStats(snippetId);
          if (!stats) return;
          const payload = `data: ${JSON.stringify(stats)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
        }
      };

      await send();

      const interval = setInterval(send, 1500);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}