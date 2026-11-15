import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { SEQ_KEY, STREAM_KEY, STREAM_MAX } from "@/lib/events";
import type { RealtimeEvent } from "@/lib/realtime-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TICK_MS = 2000;
const LIFETIME_MS = 55_000;
const HEARTBEAT_MS = 15_000;

function parseEvent(raw: unknown): RealtimeEvent | null {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj || typeof obj.id !== "number" || typeof obj.type !== "string") return null;
    return obj as RealtimeEvent;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const sinceParam = Number(req.nextUrl.searchParams.get("since") ?? "");
  const lastEventHeader = Number(req.headers.get("last-event-id") ?? "");
  let lastId = Math.max(
    Number.isFinite(sinceParam) ? sinceParam : 0,
    Number.isFinite(lastEventHeader) ? lastEventHeader : 0
  );

  // Tanpa cursor eksplisit: mulai dari event terbaru, jangan replay backlog.
  if (!lastId) {
    try {
      lastId = Number(await redis.get<number>(SEQ_KEY)) || 0;
    } catch {
      lastId = 0;
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let failures = 0;
      const startedAt = Date.now();
      let lastBeat = Date.now();

      const finish = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      };

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          finish();
        }
      };

      const tick = async () => {
        if (closed) return;

        try {
          const rows = await redis.lrange(STREAM_KEY, 0, STREAM_MAX - 1);
          failures = 0;

          const events = (rows ?? [])
            .map(parseEvent)
            .filter((event): event is RealtimeEvent => !!event && event.id > lastId)
            .sort((a, b) => a.id - b.id);

          for (const event of events) {
            lastId = Math.max(lastId, event.id);
            send(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
          }
        } catch {
          // Redis sedang down: heartbeat tetap dikirim, tapi kalau terus
          // gagal tutup koneksi supaya client fallback ke polling.
          failures += 1;
          if (failures >= 3) {
            finish();
            return;
          }
        }

        if (Date.now() - lastBeat >= HEARTBEAT_MS) {
          lastBeat = Date.now();
          send(`: ping ${lastBeat}\n\n`);
        }

        if (Date.now() - startedAt >= LIFETIME_MS) {
          finish();
          return;
        }

        timer = setTimeout(tick, TICK_MS);
      };

      send("retry: 3000\n\n");
      req.signal.addEventListener("abort", finish);
      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
