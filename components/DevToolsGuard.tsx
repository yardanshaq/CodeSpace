"use client";

/**
 * DevToolsGuard
 *
 * Komponen ini mendeteksi apakah browser developer tools sedang dibuka.
 * Jika terdeteksi, konten halaman akan disembunyikan dan diganti layar kosong.
 * Deteksi berjalan sepenuhnya di sisi klien dan tidak mempengaruhi performa server.
 *
 * Metode deteksi yang digunakan:
 * 1. Perbedaan ukuran window vs screen (devtools undocked / samping / bawah)
 * 2. Console trick via custom object getter (devtools harus membaca properti objek)
 * 3. Timing debugger (devtools memperlambat eksekusi saat breakpoint aktif)
 *
 * Fix: Deteksi dinonaktifkan pada perangkat touch (mobile/tablet) untuk
 * mencegah false-positive — browser UI (address bar, nav bar) pada mobile
 * bisa menyebabkan outerHeight - innerHeight > threshold secara normal.
 */

import { useEffect, useState } from "react";

// Ambang batas perbedaan lebar window yang dianggap "devtools terbuka"
// Hanya berlaku untuk WIDTH (bukan height) agar tidak false-positive di mobile
const THRESHOLD = 160;

export default function DevToolsGuard({ children }: { children: React.ReactNode }) {
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useEffect(() => {
    // Jika perangkat touch (mobile/tablet), skip semua deteksi
    // outerHeight - innerHeight bisa >160px di mobile karena browser UI
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    // --- Metode 1: Deteksi via lebar window (desktop only) ---
    // Saat devtools dibuka di samping, innerWidth mengecil.
    // Height check dihapus karena false-positive di laptop dengan taskbar besar.
    function checkWindowSize(): boolean {
      const widthDiff = window.outerWidth - window.innerWidth;
      return widthDiff > THRESHOLD;
    }

    // --- Metode 2: Console object getter trick ---
    // Browser hanya membaca properti "id" saat devtools merender objek di console.
    let consoleDetected = false;
    function checkConsole(): boolean {
      const check = { detected: false };
      const element = new Image();
      Object.defineProperty(element, "id", {
        get() {
          check.detected = true;
          return "";
        },
      });
      console.log("%c", element); // eslint-disable-line no-console
      return check.detected;
    }

    // --- Metode 3: Timing debugger ---
    // Pernyataan `debugger` memperlambat eksekusi secara signifikan
    // hanya jika devtools panel "Sources" sedang terbuka & pausing aktif.
    function checkDebugger(): boolean {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      return performance.now() - start > 100;
    }

    function runAllChecks() {
      const detected = checkWindowSize() || consoleDetected || checkDebugger();
      setDevToolsOpen(detected);
    }

    runAllChecks();
    consoleDetected = checkConsole();

    const interval = setInterval(runAllChecks, 1000);

    function onResize() {
      if (checkWindowSize()) setDevToolsOpen(true);
    }
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (devToolsOpen) {
    return (
      <div
        style={{
          position:       "fixed",
          inset:          0,
          background:     "var(--bg, #e8e8e8)",
          zIndex:         99999,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
        aria-hidden="true"
      />
    );
  }

  return <>{children}</>;
}