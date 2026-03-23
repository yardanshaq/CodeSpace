"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NotFoundClient() {
  const router = useRouter();
  const [path, setPath] = useState("");
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (typeof window !== "undefined") setPath(window.location.pathname);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font-mono)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid decoration */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(var(--divider) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        opacity: 0.4,
      }} />

      {/* Big 404 */}
      <div style={{
        fontSize: "clamp(100px, 22vw, 200px)",
        fontWeight: 900,
        fontStyle: "italic",
        letterSpacing: "-8px",
        lineHeight: 0.9,
        color: "transparent",
        WebkitTextStroke: "2px var(--border-color)",
        userSelect: "none",
        marginBottom: -10,
        position: "relative",
        zIndex: 1,
      }}>
        404
      </div>

      {/* Card */}
      <div style={{
        background: "var(--surface)",
        border: "2.5px solid var(--border-color)",
        borderRadius: 16,
        boxShadow: "6px 6px 0 var(--border-color)",
        padding: "36px 40px",
        maxWidth: 460,
        width: "100%",
        textAlign: "center",
        position: "relative",
        zIndex: 1,
      }}>

        {/* Terminal-style header bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 24, paddingBottom: 16,
          borderBottom: "1.5px solid var(--divider)",
        }}>
          {["#ff5f56","#ffbd2e","#27c93f"].map(c => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "block" }} />
          ))}
          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.06em" }}>
            codespace — error
          </span>
        </div>

        {/* Error content */}
        <div style={{ marginBottom: 8, color: "var(--teal)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="12"/>
            <line x1="11" y1="16" x2="11.01" y2="16"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "0.06em",
          color: "var(--text)", marginBottom: 8, textTransform: "uppercase",
        }}>
          Page Not Found
        </h1>

        <p style={{
          fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8,
          marginBottom: 24, letterSpacing: "0.02em",
        }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Simulated terminal block */}
        <div style={{
          background: "var(--surface2)", border: "1.5px solid var(--border-color)",
          borderRadius: 10, padding: "14px 16px", marginBottom: 24,
          textAlign: "left",
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--teal)" }}>$</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>GET</span>
            <span style={{ fontSize: 11, color: "#ff6b6b", wordBreak: "break-all" }}>{path || "/..."}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>→</span>
            <span style={{ fontSize: 11, color: "#ff6b6b" }}>404 Not Found</span>
            <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: "auto" }}>{dots}</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => router.back()}
            style={{
              flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              padding: "11px 16px", cursor: "pointer", color: "var(--text)",
              background: "none", border: "2px solid var(--border-color)",
              borderRadius: 8, boxShadow: "3px 3px 0 var(--border-color)",
              fontFamily: "var(--font-mono)", transition: "all .1s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translate(-1px,-1px)"; e.currentTarget.style.boxShadow = "4px 4px 0 var(--border-color)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "3px 3px 0 var(--border-color)"; }}
          >
            ← GO BACK
          </button>
          <button
            onClick={() => router.push("/")}
            style={{
              flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              padding: "11px 16px", cursor: "pointer", color: "#000",
              background: "var(--teal)", border: "2px solid var(--border-color)",
              borderRadius: 8, boxShadow: "3px 3px 0 var(--border-color)",
              fontFamily: "var(--font-mono)", transition: "all .1s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translate(-1px,-1px)"; e.currentTarget.style.boxShadow = "4px 4px 0 var(--border-color)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "3px 3px 0 var(--border-color)"; }}
          >
            HOME
          </button>
        </div>

        {/* Suggestion links */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--divider)" }}>
          <p style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.06em", marginBottom: 10, textTransform: "uppercase" }}>
            Maybe you were looking for:
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "Home", href: "/" },
              { label: "Trending", href: "/trending" },
              { label: "Feedback", href: "/feedback" },
            ].map(({ label, href }) => (
              <a key={href} href={href} style={{
                fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--teal)",
                textDecoration: "none", padding: "4px 10px",
                border: "1px solid var(--border-color)", borderRadius: 6,
                transition: "background .15s",
              }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(100,220,200,0.08)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}