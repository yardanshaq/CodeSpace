import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Cache TTL: 3 detik — cukup fresh tanpa hammer DB
const CACHE_TTL = 3;

function cacheKey(snippetId: string) {
  return `sse:stats:${snippetId}`;
}

async function getStats(snippetId: string) {
  // 1. Coba dari Redis cache dulu
  const cached = await redis.get<{
    views: number;
    likeCount: number;
    commentCount: number;
  }>(cacheKey(snippetId));

  if (cached) return cached;

  // 2. Cache miss — ambil dari DB
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

  // 3. Simpan ke cache 3 detik
  await redis.set(cacheKey(snippetId), stats, { ex: CACHE_TTL });

  return stats;
}

// Helper: invalidate cache saat ada perubahan (dipanggil dari like/comment/view route)
export async function invalidateStatsCache(snippetId: string) {
  await redis.del(cacheKey(snippetId));
}

// GET — SSE endpoint, push stats setiap 1.5 detik
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const snippetId = params.id;

  // Vercel max duration untuk SSE — set di vercel.json
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      // Kirim data saat client connect
      const send = async () => {
        if (closed) return;
        try {
          const stats = await getStats(snippetId);
          if (!stats) return;
          const payload = `data: ${JSON.stringify(stats)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Silent — jangan crash stream karena DB error
        }
      };

      // Kirim langsung saat connect
      await send();

      // Push setiap 1.5 detik
      const interval = setInterval(send, 1500);

      // Cleanup saat client disconnect
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":                "text/event-stream",
      "Cache-Control":               "no-cache, no-transform",
      "Connection":                  "keep-alive",
      "X-Accel-Buffering":           "no", // disable nginx buffering
      "Access-Control-Allow-Origin": "*",
    },
  });
}