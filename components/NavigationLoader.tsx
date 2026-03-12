"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

let _setVisible: ((v: boolean) => void) | null = null;

export function startNavigationLoader() { _setVisible?.(true); }
export function stopNavigationLoader()  { _setVisible?.(false); }

export function useNavigate() {
  const router = useRouter();
  return (href: string) => {
    startNavigationLoader();
    router.push(href);
  };
}

export default function NavigationLoader() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname  = usePathname();
  const prevPath  = useRef(pathname);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    _setVisible = setVisible;
    return () => { _setVisible = null; };
  }, []);

  useEffect(() => {
    if (visible) {
      setProgress(0);
      // Animate bar from 0 → 85% while loading
      let p = 0;
      progressRef.current = setInterval(() => {
        p = Math.min(p + Math.random() * 8 + 3, 85);
        setProgress(p);
      }, 120);
    } else {
      // Complete the bar then hide
      setProgress(100);
      if (progressRef.current) clearInterval(progressRef.current);
      const t = setTimeout(() => setProgress(0), 300);
      return () => clearTimeout(t);
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [visible]);

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      const t = setTimeout(() => setVisible(false), 80);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <>
      <div style={{
        position: "fixed",
        top: 0, left: 0,
        height: 3,
        width: `${progress}%`,
        background: "var(--teal, #4ecdc4)",
        zIndex: 99999,
        transition: progress === 100 ? "width 0.2s ease, opacity 0.3s ease" : "width 0.15s ease-out",
        opacity: progress === 100 ? 0 : 1,
        boxShadow: "0 0 8px var(--teal, #4ecdc4)",
      }} />
      <style suppressHydrationWarning>{`
        @keyframes nav-loader-shine {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}