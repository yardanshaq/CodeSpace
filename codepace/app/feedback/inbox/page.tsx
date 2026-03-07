"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";

interface FeedbackItem {
  id: string;
  body: string;
  createdAt: string;
  user: { username: string; role: string } | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const roleColor = (role: string) =>
  role === "SUPERADMIN" ? "#f5c542" : role === "ADMIN" ? "#4ecdc4" : "#aaaaaa";

export default function FeedbackInboxPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized]   = useState(false);

  const [feedbacks, setFeedbacks]   = useState<FeedbackItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth guard: SUPERADMIN only ───────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (!d.authenticated || d.user.role !== "SUPERADMIN") {
          router.replace("/");
          return;
        }
        setAuthorized(true);
        setAuthChecked(true);
      })
      .catch(() => router.replace("/"));
  }, []);

  // ── Fetch feedback list ───────────────────────────────────────────────────
  const fetchFeedback = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r    = await fetch(`/api/feedback?_=${Date.now()}`, { cache: "no-store" });
      const data = await r.json();
      if (Array.isArray(data)) {
        setFeedbacks(prev => {
          if (!silent) return data;
          // Smart merge: only update if count or latest entry changed
          if (prev.length === data.length && prev[0]?.id === data[0]?.id) return prev;
          return data;
        });
      }
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    fetchFeedback(false);
    pollRef.current = setInterval(() => fetchFeedback(true), 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [authorized, fetchFeedback]);

  if (!authChecked) return <PageLoader />;
  if (!authorized)  return null;

  return (
    <>
      <Navbar />
      <main className="main" style={{ maxWidth: 800 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.push("/post")}
              className="btn btn-white"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, padding: "7px 14px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              BACK
            </button>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Feedback Inbox
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                All user submissions
              </div>
            </div>
          </div>

          {/* Count badge */}
          {!loading && (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              background: "var(--surface)", border: "2px solid var(--border-color)",
              borderRadius: 8, padding: "6px 14px", boxShadow: "2px 2px 0 var(--border-color)",
              color: "var(--text)",
            }}>
              {feedbacks.length} submission{feedbacks.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <PageLoader />
        ) : feedbacks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)",
            border: "2px dashed var(--border-color)", borderRadius: 12,
          }}>
            No feedback submitted yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {feedbacks.map((f, i) => {
              const isOpen = expanded === f.id;
              const preview = f.body.length > 120 ? f.body.slice(0, 120) + "..." : f.body;
              return (
                <div
                  key={f.id}
                  style={{
                    background: i % 2 === 0 ? "var(--stripe-odd)" : "var(--stripe-even)",
                    border: `2px solid ${isOpen ? "var(--teal)" : "var(--border-color)"}`,
                    borderRadius: 10,
                    boxShadow: isOpen ? "3px 3px 0 var(--teal)" : "2px 2px 0 var(--border-color)",
                    overflow: "hidden",
                    transition: "border-color .15s, box-shadow .15s",
                  }}
                >
                  {/* Row header */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : f.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                      cursor: "pointer",
                    }}
                  >
                    {/* Sender avatar */}
                    {f.user ? (
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: roleColor(f.user.role), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#000", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
                        {f.user.username.slice(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface2)", border: "1.5px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                    )}

                    {/* Sender name + preview */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: f.user ? roleColor(f.user.role) : "var(--text-faint)" }}>
                          {f.user?.username ?? "anonymous"}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>
                          {formatDate(f.createdAt)} at {formatTime(f.createdAt)}
                        </span>
                      </div>
                      {!isOpen && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {preview}
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>

                  {/* Expanded body */}
                  {isOpen && (
                    <div style={{ padding: "0 16px 16px", borderTop: "1.5px solid var(--divider)" }}>
                      <p style={{
                        fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)",
                        lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        paddingTop: 14, margin: 0,
                      }}>
                        {f.body}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}