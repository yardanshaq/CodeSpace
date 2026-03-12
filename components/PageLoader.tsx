"use client";

import { useEffect, useState } from "react";
import { holdNavigationLoader, stopNavigationLoader } from "@/components/NavigationLoader";
import LoaderContent from "@/components/LoaderContent";

interface PageLoaderProps {
  timeoutMs?: number;
  label?: string;
}

export default function PageLoader({ timeoutMs = 15000 }: PageLoaderProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Grab the NavigationLoader so it doesn't vanish before we render
    holdNavigationLoader();
    // Then immediately take over (stop nav loader, show our own)
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