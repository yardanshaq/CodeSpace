"use client";

/**
 * PageLoader — full-screen loading screen reusable untuk semua halaman.
 * 
 * Timeout default 8 detik sebelum tombol Refresh muncul.
 * Untuk navigasi antar halaman (loading.tsx), timeout ini jarang tercapai
 * karena Next.js sudah dismiss loading sebelum 8 detik.
 */

import { useEffect, useState } from "react";

interface PageLoaderProps {
  timeoutMs?: number;
  label?: string;
}

export default function PageLoader({ timeoutMs = 8000, label }: PageLoaderProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return (
    <div
      style={{
        position:        "fixed",
        inset:           0,
        minHeight:       "100vh",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        background:      "var(--bg, #e8e8e8)",
        gap:             20,
        zIndex:          9000,
      }}
    >
      {/* Logo */}
      <img
        src="https://cdn.nekohime.site/file/sOyPp0Jp.png"
        alt="CS"
        width={52}
        height={52}
        style={{ borderRadius: 12, display: "block" }}
      />

      {!timedOut ? (
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width:        8,
                height:       8,
                borderRadius: "50%",
                background:   "var(--teal, #4ecdc4)",
                display:      "inline-block",
                animation:    `cs-loader-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{
            fontFamily:    "var(--font-mono, monospace)",
            fontSize:      11,
            color:         "var(--text-muted, #666)",
            letterSpacing: "0.08em",
          }}>
            Taking longer than usual...
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontFamily:    "var(--font-mono, monospace)",
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: "0.08em",
              padding:       "8px 20px",
              borderRadius:  8,
              border:        "2px solid var(--border-color, #000)",
              background:    "var(--teal, #4ecdc4)",
              color:         "#000",
              cursor:        "pointer",
              boxShadow:     "2px 2px 0 var(--border-color, #000)",
            }}
          >
            REFRESH
          </button>
        </div>
      )}

      <style>{`
        @keyframes cs-loader-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}