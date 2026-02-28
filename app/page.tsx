"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";

interface Snippet {
  id: string;
  title: string;
  filename: string;
  code: string;
  category: string;
  isPublic: boolean;
  views: number;
  admin: { username: string };
  createdAt: string;
}

interface NavUser {
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

export default function HomePage() {
  const router = useRouter();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [search, setSearch] = useState("");
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [user, setUser] = useState<NavUser | null>(null);
  const [userChecked, setUserChecked] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const checkAuth = () => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.authenticated ? data.user : null);
        setUserChecked(true);
      })
      .catch(() => { setUser(null); setUserChecked(true); });
  };

  useEffect(() => {
    checkAuth();
    // Listen event logout dari Navbar
    window.addEventListener("auth-change", checkAuth);
    return () => window.removeEventListener("auth-change", checkAuth);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSnippets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/snippets?${params.toString()}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];

    const unique = Array.from(new Set(list.map((s: Snippet) => s.admin.username))) as string[];
    setAuthors(unique);

    const filtered = selectedAuthors.length > 0
      ? list.filter((s: Snippet) => selectedAuthors.includes(s.admin.username))
      : list;

    setSnippets(filtered);
    setLoading(false);
  }, [search, selectedAuthors]);

  useEffect(() => {
    const timer = setTimeout(fetchSnippets, 300);
    return () => clearTimeout(timer);
  }, [fetchSnippets]);

  const toggleAuthor = (a: string) => {
    setSelectedAuthors((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const clearAuthors = () => setSelectedAuthors([]);

  const handlePostClick = () => {
    router.push(user ? "/post" : "/login");
  };

  return (
    <>
      <Navbar />
      <main className="main">
        <div className="home-hero">
          <h1 className="home-title">CodeSpace</h1>
          <p className="home-subtitle">a place to share simple snippets</p>


        </div>

        {/* Search + Filter + Post button */}
        <div className="search-row" style={{ maxWidth: 660, margin: "0 auto 40px", display: "flex", gap: 10, alignItems: "center" }}>
          {/* Search input */}
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search snippets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingRight: 52 }}
            />
            <span className="search-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
          </div>

          {/* Filter button */}
          <div ref={filterRef} className="search-action-btn" style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setShowFilter((v) => !v)}
              style={{
                width: 52, height: 52,
                border: "2.5px solid var(--border-color)",
                borderRadius: 12,
                background: selectedAuthors.length > 0 ? "var(--teal)" : "var(--surface)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "3px 3px 0 var(--border-color)",
                position: "relative", flexShrink: 0,
              }}
              title="Filter by author"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
                <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
                <line x1="1" y1="14" x2="7" y2="14"/>
                <line x1="9" y1="8" x2="15" y2="8"/>
                <line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
              {selectedAuthors.length > 0 && (
                <span style={{
                  position: "absolute", top: -8, right: -8,
                  background: "var(--red)", color: "#fff",
                  borderRadius: "50%", width: 20, height: 20,
                  fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid var(--border-color)",
                  fontFamily: "var(--font-mono)",
                }}>
                  {selectedAuthors.length}
                </span>
              )}
            </button>

            {showFilter && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                background: "var(--surface)",
                border: "2.5px solid var(--border-color)",
                borderRadius: 12,
                boxShadow: "4px 4px 0 var(--border-color)",
                padding: 16,
                minWidth: 200,
                zIndex: 100,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text)" }}>
                    FILTER BY AUTHOR
                  </span>
                  {selectedAuthors.length > 0 && (
                    <button onClick={clearAuthors} style={{ fontSize: 10, fontFamily: "var(--font-mono)", background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontWeight: 700 }}>
                      CLEAR
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {authors.map((a) => {
                    const selected = selectedAuthors.includes(a);
                    return (
                      <div key={a} onClick={() => toggleAuthor(a)} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px",
                        border: `2px solid ${selected ? "var(--teal)" : "var(--border-color)"}`,
                        borderRadius: 8, cursor: "pointer",
                        background: selected ? "rgba(78,205,196,0.1)" : "var(--surface)",
                        boxShadow: selected ? "2px 2px 0 var(--teal)" : "2px 2px 0 var(--border-color)",
                        transition: "all .1s",
                      }}>
                        <div style={{
                          width: 18, height: 18,
                          border: "2px solid var(--border-color)",
                          borderRadius: 4,
                          background: selected ? "var(--teal)" : "var(--surface)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, flexShrink: 0, color: "#000",
                        }}>
                          {selected && "✓"}
                        </div>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>{a}</span>
                      </div>
                    );
                  })}
                </div>
                {selectedAuthors.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--divider)", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {selectedAuthors.length} author{selectedAuthors.length > 1 ? "s" : ""} selected
                  </div>
                )}
              </div>
            )}
          </div>

          {/* POST button — hanya tampil kalau sudah login */}
          {userChecked && user && (
            <button
              onClick={handlePostClick}
              title="Post a snippet"
              className="search-action-btn"
              style={{
                height: 52, padding: "0 18px", flexShrink: 0,
                border: "2.5px solid var(--border-color)",
                borderRadius: 12,
                background: "var(--teal)",
                color: "#000",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                boxShadow: "3px 3px 0 var(--border-color)",
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.06em",
                transition: "all .1s",
                whiteSpace: "nowrap",
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translate(-1px,-1px)"; e.currentTarget.style.boxShadow = "4px 4px 0 var(--border-color)"; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "3px 3px 0 var(--border-color)"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              POST
            </button>
          )}
        </div>

        {/* Snippets grid */}
        {loading ? (
          <PageLoader />
        ) : snippets.length === 0 ? (
          <div className="loading">NO SNIPPETS FOUND.</div>
        ) : (
          <div className="snippets-grid">
            {snippets.map((snippet) => (
              <div key={snippet.id} className="snippet-card">
                <div className="snippet-card-header">
                  <span className="snippet-card-title" onClick={() => router.push(`/code?v=${snippet.filename}`)}>
                    {snippet.title}
                  </span>
                  <span className="snippet-views">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    {snippet.views}
                  </span>
                </div>

                <span className="snippet-filename">{snippet.filename}</span>
                <span className="snippet-category-badge">{snippet.category.toUpperCase()}</span>

                <div className="snippet-card-footer">
                  <span className="snippet-author">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {snippet.admin.username}
                  </span>
                  <button className="btn btn-black" onClick={() => router.push(`/code?v=${snippet.filename}`)}>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── FOOTER ─── */}
      <footer style={{
        marginTop: 80,
        borderTop: "2.5px solid var(--border-color)",
        background: "var(--surface)",
        boxShadow: "0 -4px 0 var(--border-color)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 0" }}>

          {/* Top section */}
          <div className="footer-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 40, marginBottom: 36 }}>

            {/* Brand */}
            <div className="footer-brand" style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "var(--teal)",
                  border: "2px solid var(--border-color)",
                  boxShadow: "2px 2px 0 var(--border-color)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text)" }}>
                  CodeSpace
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", maxWidth: 220, lineHeight: 1.8 }}>
                A minimalist platform to share and discover code snippets.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {[
                  { href: "https://instagram.com/shaqsyr", icon: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></> },
                  { href: "https://github.com/yardanshaq", icon: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/> },
                ].map(({ href, icon }) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{
                    width: 36, height: 36, borderRadius: 8, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "var(--text-muted)",
                    border: "2px solid var(--border-color)",
                    boxShadow: "2px 2px 0 var(--border-color)",
                    background: "var(--surface2)",
                    transition: "all .15s",
                  }}
                    onMouseOver={(e) => { e.currentTarget.style.color = "var(--teal)"; e.currentTarget.style.transform = "translate(-1px,-1px)"; e.currentTarget.style.boxShadow = "3px 3px 0 var(--border-color)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "2px 2px 0 var(--border-color)"; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {icon}
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="footer-links" style={{ display: "flex", gap: 40, flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", borderBottom: "1.5px solid var(--border-color)", paddingBottom: 8 }}>
                  Navigate
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Home", href: "/" },
                    { label: "Post a Snippet", href: "/post" },
                  ].map(({ label, href }) => (
                    <a key={href} href={href} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", textDecoration: "none", transition: "color .15s" }}
                      onMouseOver={(e) => (e.currentTarget.style.color = "var(--teal)")}
                      onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", borderBottom: "1.5px solid var(--border-color)", paddingBottom: 8 }}>
                  Categories
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Scrape", "AI", "Downloader", "Search", "Tools"].map((cat) => (
                    <span key={cat} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", transition: "color .15s" }}
                      onMouseOver={(e) => (e.currentTarget.style.color = "var(--teal)")}
                      onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom" style={{
          borderTop: "2px solid var(--border-color)",
          background: "var(--surface2)",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 0,
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>
            © {new Date().getFullYear()} CodeSpace · Built by{" "}
            <a href="https://github.com/yardanshaq" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--text-muted)", textDecoration: "none" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--teal)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
              shaq
            </a>
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block", boxShadow: "0 0 6px var(--green)" }} />
            All systems operational
          </span>
        </div>
      </footer>
    </>
  );
}