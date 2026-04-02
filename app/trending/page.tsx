"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNavigate } from "@/components/NavigationLoader";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";

interface Snippet {
  id: string;
  title: string;
  filename: string;
  category: string;
  views: number;
  likeCount: number;
  commentCount: number;
  admin: { username: string };
  createdAt: string;
  updatedAt: string;
}

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "a day ago";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays === 7) {
    return "a week ago";
  } else {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  Scrape: "#4ecdc4", AI: "#f5c542", Downloader: "#f25c54",
  Search: "#a78bfa", Tools: "#4ade80",
};

type Period = "all" | "week" | "month";

function filterByPeriod(list: Snippet[], period: Period): Snippet[] {
  if (period === "all") return list;
  const cutoff = Date.now() - (period === "week" ? 7 : 30) * 24 * 60 * 60 * 1000;
  return list.filter(s => new Date(s.createdAt).getTime() > cutoff);
}

export default function TrendingPage() {
  const router = useRouter();
  const navigate = useNavigate();
  // Cache semua data di sini — fetch cuma sekali, filter di client
  const cacheRef                    = useRef<Snippet[] | null>(null);
  const [allSnippets, setAllSnippets] = useState<Snippet[]>([]);
  const [period, setPeriod]         = useState<Period>("all");
  const [loading, setLoading]       = useState(true);

  const snippets = filterByPeriod(allSnippets, period);
  const top3     = snippets.slice(0, 3);
  const rest     = snippets.slice(3);

  const fetchAll = useCallback(async (silent = false) => {
    // Kalau sudah ada cache, langsung pakai dulu
    if (cacheRef.current && silent) {
      setAllSnippets(cacheRef.current);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res  = await fetch("/api/snippets?sortBy=views&order=desc");
      const data = await res.json();
      const list: Snippet[] = Array.isArray(data) ? data : [];
      cacheRef.current = list;
      setAllSnippets(list);
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    // Kalau cache sudah ada (navigasi balik), render langsung tanpa loading
    if (cacheRef.current) {
      setAllSnippets(cacheRef.current);
      setLoading(false);
    }
    fetchAll(false);
    // Poll tiap 15 detik secara silent
    const t = setInterval(() => fetchAll(true), 15000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // Period switch — INSTAN karena filter di client, tidak fetch ulang
  const handlePeriod = (p: Period) => setPeriod(p);

  return (
    <>
      <Navbar />
      <main className="main" style={{ maxWidth: 860 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: "var(--yellow)",
              border: "2.5px solid var(--border-color)", boxShadow: "3px 3px 0 var(--border-color)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
                Trending
              </h1>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Most viewed snippets on CodeSpace
              </p>
            </div>
          </div>

          {/* Period filter — switch instan, no refetch */}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            {([ ["all","All Time"], ["week","This Week"], ["month","This Month"] ] as [Period, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => handlePeriod(val)}
                aria-pressed={period === val}
                aria-label={`Filter by ${label}`}
                style={{
                  padding: "7px 16px", borderRadius: 8,
                  border: "2px solid var(--border-color)",
                  background: period === val ? "var(--text)" : "var(--surface)",
                  color:      period === val ? "var(--surface)" : "var(--text-muted)",
                  cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.04em", boxShadow: "2px 2px 0 var(--border-color)",
                  transition: "box-shadow 0.12s ease, transform 0.12s ease",
                }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 var(--border-color)"; }}
                onMouseOut={e  => { (e.currentTarget as HTMLElement).style.transform = "none";                 (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 var(--border-color)"; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <PageLoader />
        ) : snippets.length === 0 ? (
          <div className="loading" role="status">No snippets found for this period.</div>
        ) : (
          <>
            {/* Top 3 podium */}
            {top3.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
                {top3.map((s, i) => {
                  const medals = ["#f5c542", "#aaaaaa", "#cd7f32"];
                  const medal  = medals[i] ?? "var(--teal)";
                  return (
                    <div
                      key={s.id}
                      onClick={() => navigate(`/code?v=${s.filename}`)}
                      role="article"
                      aria-label={`#${i+1} trending: ${s.title}`}
                      style={{
                        background: "var(--surface)", border: `2.5px solid ${medal}`,
                        borderRadius: 14, padding: 20, cursor: "pointer",
                        boxShadow: `4px 4px 0 ${medal}`,
                        transition: "box-shadow 0.12s ease, transform 0.12s ease",
                        display: "flex", flexDirection: "column", gap: 10,
                      }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "translate(-2px,-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `6px 6px 0 ${medal}`; }}
                      onMouseOut={e  => { (e.currentTarget as HTMLElement).style.transform = "none";                  (e.currentTarget as HTMLElement).style.boxShadow = `4px 4px 0 ${medal}`; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", background: medal,
                          border: "2px solid var(--border-color)", display: "flex", alignItems: "center",
                          justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 900, color: "#000",
                        }}>
                          {i + 1}
                        </div>
                        <span style={{
                          padding: "2px 10px", borderRadius: 4,
                          background: CATEGORY_COLORS[s.category] ?? "var(--teal)",
                          color: "#000", fontSize: 9, fontWeight: 700,
                          fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
                          border: "1.5px solid var(--border-color)",
                        }}>
                          {s.category.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text)", lineHeight: 1.4 }}>
                        {s.title}
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          {s.views}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                          {s.likeCount}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                        by {s.admin.username} · {formatDate(s.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Remaining list */}
            {rest.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "2.5px solid var(--border-color)", borderRadius: 12, overflow: "hidden", boxShadow: "4px 4px 0 var(--border-color)" }}>
                {rest.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/code?v=${s.filename}`)}
                    role="listitem"
                    style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                      background: i % 2 === 0 ? "var(--stripe-odd)" : "var(--stripe-even)",
                      borderBottom: "1.5px solid var(--divider)",
                      cursor: "pointer", transition: "background .1s",
                    }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                    onMouseOut={e  => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "var(--stripe-odd)" : "var(--stripe-even)"; }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", minWidth: 24, fontWeight: 700 }}>
                      {i + 4}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                        {s.admin.username} · {formatDate(s.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        {s.views}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        {s.likeCount}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: CATEGORY_COLORS[s.category] ?? "var(--teal)", color: "#000", fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", border: "1.5px solid var(--border-color)" }}>
                        {s.category.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}