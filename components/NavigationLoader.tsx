"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoaderContent from "@/components/LoaderContent";

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
  const pathname  = usePathname();
  const prevPath  = useRef(pathname);

  useEffect(() => {
    _setVisible = setVisible;
    return () => { _setVisible = null; };
  }, []);

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
      <LoaderContent />
    </div>
  );
}