"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoaderContent from "@/components/LoaderContent";

let _setVisible: ((v: boolean) => void) | null = null;
let _held = false; // PageLoader is holding the loader open

export function startNavigationLoader() { _setVisible?.(true); }

export function stopNavigationLoader() {
  _held = false;
  _setVisible?.(false);
}

// Called by PageLoader on mount — keeps loader visible until PageLoader is ready
export function holdNavigationLoader() {
  _held = true;
}

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

  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      // Only auto-hide if no PageLoader is holding it
      const t = setTimeout(() => {
        if (!_held) setVisible(false);
      }, 80);
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
      <LoaderContent />
    </div>
  );
}