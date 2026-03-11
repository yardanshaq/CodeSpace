"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Singleton state — bisa di-trigger dari mana saja
let _setVisible: ((v: boolean) => void) | null = null;

export function startNavigationLoader() {
  _setVisible?.(true);
}
export function stopNavigationLoader() {
  _setVisible?.(false);
}

// Hook untuk router.push dengan instant loader
export function useNavigate() {
  const router = useRouter();
  return (href: string) => {
    startNavigationLoader();
    router.push(href);
  };
}

export default function NavigationLoader() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    _setVisible = setVisible;
    return () => { _setVisible = null; };
  }, []);

  // When pathname changes, give PageLoader 80ms to mount and take over.
  // If nothing takes over (pages without PageLoader), hide automatically.
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      const t = setTimeout(() => setVisible(false), 80);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <img
        src="https://cdn.nekohime.site/file/sOyPp0Jp.png"
        alt="CS" width={52} height={52}
        className="cs-loader-logo"
        style={{ borderRadius: 12, display: "block", animation: "cs-logo-entrance 1.5s ease-in-out infinite", willChange: "transform" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--teal, #4ecdc4)", display: "inline-block",
            animation: `cs-loader-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style suppressHydrationWarning>{`
        @keyframes cs-loader-bounce {
          0%,80%,100% { transform:translateY(0);opacity:.4 }
          40% { transform:translateY(-10px);opacity:1 }
        }
        @keyframes cs-logo-entrance {
          0%   { transform: translateZ(0) rotate(0deg)   scale(1); }
          35%  { transform: translateZ(0) rotate(360deg) scale(1.08); }
          52%  { transform: translateZ(0) rotate(360deg) scale(0.95); }
          66%  { transform: translateZ(0) rotate(360deg) scale(1.02); }
          78%  { transform: translateZ(0) rotate(360deg) scale(1); }
          100% { transform: translateZ(0) rotate(360deg) scale(1); }
        }
        [data-theme="dark"] .cs-loader-logo { filter:invert(1); }
      `}</style>
    </div>
  );
}