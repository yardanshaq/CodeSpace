"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

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
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const CATEGORY_COLORS: Record<string, string> = {
  Scrape:     "#4ecdc4",
  AI:         "#f5c542",
  Downloader: "#f25c54",
  Search:     "#a78bfa",
  Tools:      "#4ade80",
};

export default function TrendingPage() {
  const router = useRouter();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading]   = useState(true);
  const [period, setPeriod]     = useState<"all" | "week" | "month">("all");

  useEffect(() => {
    setLoading(true);
    fetch("/api/snippets?sortBy=views&order=desc")
      .then(r => r.json())
      .then(data => {
        let list: Snippet[] = Array.isArray(data) ? data : [];

        if (period === "week") {
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
          list = list.filter(s => new Date(s.createdAt).getTime() > cutoff);
        } else if (period === "month") {
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          list = list.filter(s => new Date(s.createdAt).getTime() > cutoff);
        }

        setSnippets(list);
      })
      .catch(() => setSnippets([]))
      .finally(() => setLoading(false));
  }, [period]);

  const top3 = snippets.slice(0, 3);
  const rest = snippets.slice(3);

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

          {/* Period filter */}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            {([["all","All Time"],["week","This Week"],["month","This Month"]] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                style={{
                  padding: "7px 16px", borderRadius: 8,
                  border: `2px solid ${period === val ? "var(--border-color)" : "var(--border-color)"}`,
                  background: period === val ? "var(--text)" : "var(--surface)",
                  color: period === val ? "var(--surface)" : "var(--text-muted)",
                  cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.04em", boxShadow: "2px 2px 0 var(--border-color)", transition: "all .1s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading trending snippets...</div>
        ) : snippets.length === 0 ? (
          <div className="loading">No snippets found for this period.</div>
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
                      onClick={() => router.push(`/code?v=${s.filename}`)}
                      style={{
                        background: "var(--surface)", border: `2.5px solid ${medal}`,
                        borderRadius: 14, padding: 20, cursor: "pointer",
                        boxShadow: `4px 4px 0 ${medal}`, transition: "all .15s",
                        display: "flex", flexDirection: "column", gap: 10,
                      }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "translate(-2px,-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `6px 6px 0 ${medal}`; }}
                      onMouseOut={e  => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = `4px 4px 0 ${medal}`; }}
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
                    onClick={() => router.push(`/code?v=${s.filename}`)}
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