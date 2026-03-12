"use client";

import { useEffect, useState } from "react";
import LoaderContent from "@/components/LoaderContent";

export default function PageLoader({ timeoutMs = 15000 }: { timeoutMs?: number }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Remove the instant overlay — PageLoader is now handling visuals
    document.body.classList.remove("nav-loading");
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg, #e8e8e8)",
      gap: 20, zIndex: 9000,
    }}>
      <LoaderContent timedOut={timedOut} />
    </div>
  );
}