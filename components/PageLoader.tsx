"use client";

import { useEffect, useState } from "react";
import { stopNavigationLoader } from "@/components/NavigationLoader";
import LoaderContent from "@/components/LoaderContent";

export default function PageLoader({ timeoutMs = 15000 }: { timeoutMs?: number; label?: string }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Stop NavigationLoader immediately — we take over the same visual
    stopNavigationLoader();
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => {
      clearTimeout(timer);
      window.dispatchEvent(new CustomEvent("cs-loader-done"));
    };
  }, [timeoutMs]);

  return (
    <div style={{
      position: "fixed", inset: 0, minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg, #e8e8e8)",
      gap: 20, zIndex: 9000,
    }}>
      <LoaderContent timedOut={timedOut} />
    </div>
  );
}