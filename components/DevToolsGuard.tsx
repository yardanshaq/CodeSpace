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
 */

import { useEffect, useState } from "react";

// Ambang batas perbedaan ukuran window yang dianggap "devtools terbuka"
const THRESHOLD = 160;

export default function DevToolsGuard({ children }: { children: React.ReactNode }) {
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useEffect(() => {
    // --- Metode 1: Deteksi via ukuran window ---
    // Saat devtools dibuka di samping atau bawah, ukuran window mengecil
    // relatif terhadap ukuran layar fisik.
    function checkWindowSize(): boolean {
      const widthDiff  = window.outerWidth  - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      return widthDiff > THRESHOLD || heightDiff > THRESHOLD;
    }

    // --- Metode 2: Console object getter trick ---
    // Browser hanya membaca properti "id" saat devtools merender objek di console.
    // Jika getter terpanggil, berarti devtools sedang aktif.
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
      // Panggil console.log — devtools yang terbuka akan membaca properti "id"
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

    // Jalankan sekali saat mount, lalu terus polling setiap 1 detik
    runAllChecks();

    // Console check dijalankan sekali lalu hasilnya disimpan
    // (tidak perlu polling karena getter akan tertrigger terus)
    consoleDetected = checkConsole();

    const interval = setInterval(runAllChecks, 1000);

    // Deteksi juga lewat event resize — paling cepat menangkap devtools samping/bawah
    function onResize() {
      if (checkWindowSize()) setDevToolsOpen(true);
    }
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Saat devtools terdeteksi, tampilkan layar kosong
  if (devToolsOpen) {
    return (
      <div
        style={{
          position:        "fixed",
          inset:           0,
          background:      "var(--bg, #e8e8e8)",
          zIndex:          99999,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
        }}
        aria-hidden="true"
      />
    );
  }

  return <>{children}</>;
}
