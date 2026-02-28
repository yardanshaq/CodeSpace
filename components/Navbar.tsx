"use client";

import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCachedUser, setCachedUser } from "@/lib/authCache";

interface NavUser {
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();

  const [user, setUser]         = useState<NavUser | null>(() => getCachedUser());
  const [dropdownOpen, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) { setUser(d.user); setCachedUser(d.user); }
        else                  { setUser(null);   setCachedUser(null);   }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCachedUser(null);
    window.dispatchEvent(new Event("auth-change"));
    const guarded = ["/post", "/settings", "/users"];
    router.push(guarded.some(p => pathname?.startsWith(p)) ? "/login" : "/");
    router.refresh();
  };

  const isDark      = theme === "dark";
  const roleColor   = user?.role === "SUPERADMIN" ? "#f5c542" : user?.role === "ADMIN" ? "#4ecdc4" : "#aaaaaa";
  // Gunakan CSS variables — nilainya langsung benar dari frame pertama
  // karena blocking script di layout.tsx sudah set data-theme sebelum render
  const borderCol   = "var(--navbar-border)";
  const shadow0     = "#000";
  const glassBg     = "var(--navbar-bg)";
  const dropBg      = "var(--navbar-drop-bg)";
  const hoverBg     = "var(--navbar-hover-bg)";
  const initials    = user ? user.username.slice(0, 2).toUpperCase() : "";

  const pillW   = scrolled ? "min(640px, calc(100vw - 24px))" : "min(960px, calc(100vw - 32px))";
  const pillH   = scrolled ? 46 : 56;
  const pillTop = scrolled ? 10 : 18;
  const pillShadow = scrolled ? `3px 3px 0 ${shadow0}` : `5px 5px 0 ${shadow0}`;

  return (
    <>
      <div style={{ height: pillTop + pillH + 12 }} />

      <nav style={{
        position: "fixed", top: pillTop, left: "50%", transform: "translateX(-50%)",
        width: pillW, zIndex: 1000,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: pillH, padding: "0 8px 0 10px", borderRadius: 999,
          background: glassBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: `2.5px solid ${borderCol}`, boxShadow: pillShadow,
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", gap: 6,
        }}>

          {/* LOGO */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <div style={{
              width: scrolled ? 28 : 32, height: scrolled ? 28 : 32, borderRadius: 8,
              background: "var(--teal)", border: "2px solid var(--navbar-border)",
              boxShadow: `2px 2px 0 ${shadow0}`, display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, transition: "all 0.3s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <span className="nav-brand-text" style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text)" }}>
              CodeSpace
            </span>
          </Link>

          {/* CENTER spacer */}
          <div className="nav-center-links" style={{ flex: 1 }} />

          {/* RIGHT */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>

            {/* Socials */}
            <div className="nav-socials-group" style={{ display: "flex", gap: 1 }}>
              <a href="https://instagram.com/shaqsyr" target="_blank" rel="noopener noreferrer"
                style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", transition: "all .15s", border: "2px solid transparent", background: "transparent" }}
                onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.border = `2px solid ${borderCol}`; }}
                onMouseOut={e  => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.border = "2px solid transparent"; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="https://github.com/yardanshaq" target="_blank" rel="noopener noreferrer"
                style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", transition: "all .15s", border: "2px solid transparent", background: "transparent" }}
                onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.border = `2px solid ${borderCol}`; }}
                onMouseOut={e  => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.border = "2px solid transparent"; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                </svg>
              </a>
            </div>

            {/* Divider */}
            <div className="nav-divider" style={{ width: 1, height: 18, background: "var(--navbar-divider)", margin: "0 4px" }} />

            {/* Theme */}
            <button onClick={toggle}
              style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, border: "2px solid transparent", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
              onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.border = `2px solid ${borderCol}`; }}
              onMouseOut={e  => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.border = "2px solid transparent"; }}
            >
              {theme === "light" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </button>

            {/* AUTH */}
            {user ? (
              <div ref={dropdownRef} style={{ position: "relative", marginLeft: 2 }}>
                <button onClick={() => setOpen(v => !v)} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  height: 36, padding: "0 10px 0 4px",
                  background: dropdownOpen ? hoverBg : "transparent",
                  border: `2px solid ${dropdownOpen ? roleColor : "transparent"}`,
                  borderRadius: 999, cursor: "pointer", transition: "all .15s",
                  boxShadow: dropdownOpen ? `2px 2px 0 ${shadow0}` : "none",
                }}
                  onMouseOver={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderColor = roleColor; e.currentTarget.style.boxShadow = `2px 2px 0 ${shadow0}`; }}
                  onMouseOut={e  => { if (!dropdownOpen) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "none"; } }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", background: roleColor,
                    border: "2px solid var(--surface)", outline: `2px solid ${roleColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 900, color: "#000", fontFamily: "var(--font-mono)", flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <span className="nav-username-text" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: roleColor }}>
                    {user.username}
                  </span>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: "var(--text-faint)", transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {dropdownOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 10px)",
                    background: dropBg, border: "2.5px solid var(--border-color)",
                    borderRadius: 14, minWidth: 210, boxShadow: "4px 4px 0 #000",
                    zIndex: 9999, overflow: "hidden",
                  }}>
                    {/* Header */}
                    <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1.5px solid var(--divider)" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: roleColor, border: "2px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#000", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: roleColor }}>{user.username}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3, fontFamily: "var(--font-mono)" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: roleColor, display: "inline-block" }} />
                          {user.role}
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    {[
                      ...(user.role === "SUPERADMIN" ? [{
                        label: "Users", href: "/users",
                        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                      }] : []),
                      { label: "Post", href: "/post", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
                      { label: "Settings", href: "/settings", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
                    ].map(({ label, href, icon }) => (
                      <button key={href} onClick={() => { setOpen(false); router.push(href); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", textAlign: "left", transition: "background .1s" }}
                        onMouseOver={e => e.currentTarget.style.background = hoverBg}
                        onMouseOut={e  => e.currentTarget.style.background = "transparent"}
                      >
                        {icon}{label}
                      </button>
                    ))}

                    {/* Sign out */}
                    <button onClick={handleLogout}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", background: "transparent", border: "none", borderTop: "1.5px solid var(--divider)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12, color: "#ff6b6b", textAlign: "left", transition: "background .1s" }}
                      onMouseOver={e => e.currentTarget.style.background = "rgba(255,107,107,0.08)"}
                      onMouseOut={e  => e.currentTarget.style.background = "transparent"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a href="/login" style={{
                display: "flex", alignItems: "center", gap: 6, marginLeft: 4,
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.07em", textDecoration: "none",
                padding: "8px 16px", borderRadius: 999,
                background: "var(--teal)", color: "#000",
                border: "2px solid var(--navbar-border)",
                boxShadow: `2px 2px 0 ${shadow0}`,
                transition: "all .15s", whiteSpace: "nowrap",
              }}
                onMouseOver={e => { e.currentTarget.style.transform = "translate(-1px,-1px)"; e.currentTarget.style.boxShadow = `3px 3px 0 ${shadow0}`; }}
                onMouseOut={e  => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `2px 2px 0 ${shadow0}`; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                SIGN IN
              </a>
            )}

          </div>
        </div>
      </nav>
    </>
  );
}