import { redis } from "@/lib/redis";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/realtime-types";

// Event log disimpan di Redis supaya semua instance serverless melihat
// urutan kejadian yang sama. Client mengambilnya lewat /api/events/sse.
export const STREAM_KEY = "rt:events";
export const SEQ_KEY = "rt:seq";
export const STREAM_MAX = 200;

export async function publishEvent(
  type: RealtimeEventType,
  data: Record<string, unknown> = {}
): Promise<void> {
  try {
    const id = await redis.incr(SEQ_KEY);
    const event: RealtimeEvent = { id, type, ts: Date.now(), ...data };

    await redis
      .pipeline()
      .lpush(STREAM_KEY, JSON.stringify(event))
      .ltrim(STREAM_KEY, 0, STREAM_MAX - 1)
      .expire(STREAM_KEY, 3600)
      .exec();
  } catch (error) {
    // Realtime bersifat best-effort: kegagalan publish tidak boleh
    // menggagalkan request utama (post/like/comment tetap tersimpan).
    console.error("[realtime] publish failed:", error);
  }
}
