"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const OVERLAY_ID = "cs-nav-overlay";
const OVERLAY_MAX_MS = 12000;

let overlayTimer: ReturnType<typeof setTimeout> | null = null;

export function startNavigationLoader() {
  if (document.getElementById(OVERLAY_ID)) return;
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg").trim() || "#e8e8e8";
  const teal = getComputedStyle(document.documentElement)
    .getPropertyValue("--teal").trim() || "#4ecdc4";
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:${bg};
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:20px;
  `;
  el.innerHTML = `
    <style>
      @keyframes _cs_spin {
        0%   { transform:translateZ(0) rotate(0deg)   scale(1); }
        35%  { transform:translateZ(0) rotate(360deg) scale(1.08); }
        52%  { transform:translateZ(0) rotate(360deg) scale(0.95); }
        66%  { transform:translateZ(0) rotate(360deg) scale(1.02); }
        78%  { transform:translateZ(0) rotate(360deg) scale(1); }
        100% { transform:translateZ(0) rotate(360deg) scale(1); }
      }
      @keyframes _cs_bounce {
        0%,80%,100% { transform:translateY(0);opacity:0.4; }
        40%          { transform:translateY(-10px);opacity:1; }
      }
      #cs-nav-overlay img { animation:_cs_spin 1.5s ease-in-out infinite;will-change:transform; }
      #cs-nav-overlay span { animation:_cs_bounce 1.2s ease-in-out infinite; }
      #cs-nav-overlay span:nth-child(2) { animation-delay:0.2s; }
      #cs-nav-overlay span:nth-child(3) { animation-delay:0.4s; }
    </style>
    <img src="/logo.png"
      width="52" height="52"
      style="border-radius:12px;display:block;${isDark ? "filter:invert(1)" : ""}"
    />
    <div style="display:flex;gap:8px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${teal};display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:${teal};display:inline-block;"></span>
      <span style="width:8px;height:8px;border-radius:50%;background:${teal};display:inline-block;"></span>
    </div>
  `;
  document.body.appendChild(el);

  // Safety net: navigasi yang gagal/nyangkut tidak boleh meninggalkan
  // overlay full-screen permanen.
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(stopNavigationLoader, OVERLAY_MAX_MS);
}

export function stopNavigationLoader() {
  if (overlayTimer) {
    clearTimeout(overlayTimer);
    overlayTimer = null;
  }
  document.getElementById(OVERLAY_ID)?.remove();
}

export function useNavigate() {
  const router = useRouter();
  return (href: string) => {
    startNavigationLoader();
    router.push(href);
  };
}

export default function NavigationLoader() {
  const pathname = usePathname();

  // Route sudah commit -> overlay pasti dilepas, termasuk kasus navigasi
  // instan dari prefetch cache di mana loading.tsx tidak sempat dirender.
  useEffect(() => {
    stopNavigationLoader();
  }, [pathname]);

  return null;
}
