"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoaderContent from "@/components/LoaderContent";

// ── Singleton state ─────────────────────────────────────────
let _setShowing: ((v: boolean) => void) | null = null;
let _refCount = 0; // how many "holders" want the loader visible

function show() {
  _refCount++;
  _setShowing?.(true);
}

function hide() {
  _refCount = Math.max(0, _refCount - 1);
  if (_refCount === 0) _setShowing?.(false);
}

export function startNavigationLoader() { show(); }
export function stopNavigationLoader()  { hide(); }

export function useNavigate() {
  const router = useRouter();
  return (href: string) => {
    startNavigationLoader();
    router.push(href);
  };
}

// ── PageLoader hook — used inside page components ────────────
// Call this once at the top of a page component that has its own
// loading state, so the singleton loader is hidden when ready.
export function usePageLoader(loading: boolean) {
  const held = useRef(false);
  useEffect(() => {
    if (loading && !held.current) {
      held.current = true;
      show();
    }
    if (!loading && held.current) {
      held.current = false;
      hide();
    }
    return () => {
      if (held.current) { held.current = false; hide(); }
    };
  }, [loading]);
}

// ── The one global loader in the DOM ────────────────────────
export default function NavigationLoader() {
  const [showing, setShowing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    _setShowing = (v) => {
      setShowing(v);
      if (v) {
        setTimedOut(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setTimedOut(true), 15000);
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };
    return () => { _setShowing = null; };
  }, []);

  // Auto-hide when pathname changes (fallback for pages without PageLoader)
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        _refCount = 0;
        _setShowing?.(false);
      }, 80);
    }
  }, [pathname]);

  if (!showing) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <LoaderContent timedOut={timedOut} />
    </div>
  );
}