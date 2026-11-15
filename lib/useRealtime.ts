"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@/lib/realtime-types";

/**
 * Subscribe ke event global (post/like/comment) lewat SSE.
 * EventSource otomatis reconnect; saat tab disembunyikan koneksi ditutup
 * supaya tidak membebani server dan Redis.
 */
export function useRealtime(onEvent: (event: RealtimeEvent) => void) {
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    let source: EventSource | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped || source) return;
      source = new EventSource("/api/events/sse");
      source.onopen = () => setConnected(true);
      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          if (event && typeof event.type === "string") callback.current(event);
        } catch {
          // payload rusak / heartbeat: abaikan
        }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        if (!stopped && !document.hidden) {
          // EventSource sudah punya retry internal, tapi setelah close manual
          // kita sambung ulang dengan jeda agar tidak menembak terus-menerus.
          setTimeout(connect, 3000);
        }
      };
    };

    const onVisibility = () => {
      if (document.hidden) {
        source?.close();
        source = null;
        setConnected(false);
      } else {
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      source?.close();
      source = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return connected;
}
