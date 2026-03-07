"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getCachedUser, setCachedUser } from "@/lib/authCache";

interface NavUser {
  username: string;
  role: string;
}

const INFO_CARDS = [
  {
    icon: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 7v5m0 4h.01" strokeLinecap="round" strokeLinejoin="round"/>,
    title: "Bug Reports",
    desc:  "Something broken? Describe what happened and what you expected.",
  },
  {
    icon: <><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round"/></>,
    title: "Feature Requests",
    desc:  "Got an idea to make CodeSpace better? We'd love to hear it.",
  },
  {
    icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></>,
    title: "General Feedback",
    desc:  "Anything else — compliments, complaints, suggestions — all welcome.",
  },
];

export default function FeedbackPage() {
  const router = useRouter();
  const [user, setUser]           = useState<NavUser | null>(null);
  const [userChecked, setUserChecked] = useState(false);

  const [body, setBody]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  const MAX = 5000;

  useEffect(() => {
    const cached = getCachedUser();
    if (cached) { setUser(cached); }
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { const u = d.authenticated ? d.user : null; setUser(u); setCachedUser(u); setUserChecked(true); })
      .catch(() => { setUser(null); setUserChecked(true); });
  }, []);

  const handleSubmit = async () => {
    if (!body.trim()) { setError("Please write something before submitting."); return; }
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Failed to submit."); }
      else        { setSuccess(true); }
    } catch { setError("Network error. Please try again."); }
    setSubmitting(false);
  };

  return (
    <>
      <Navbar />
      <main className="main" style={{ maxWidth: 660 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <button
            onClick={() => router.push("/")}
            className="btn btn-white"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, padding: "7px 14px", flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            BACK
          </button>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Send Feedback
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              Your thoughts help make CodeSpace better
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {INFO_CARDS.map(({ icon, title, desc }) => (
            <div key={title} style={{ background: "var(--surface)", border: "2px solid var(--border-color)", borderRadius: 10, padding: "14px 14px 16px", boxShadow: "2px 2px 0 var(--border-color)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" style={{ marginBottom: 8 }}>
                {icon}
              </svg>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{title}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Form / Success */}
        <div style={{ background: "var(--surface)", border: "2.5px solid var(--border-color)", borderRadius: 12, boxShadow: "4px 4px 0 var(--border-color)", overflow: "hidden" }}>
          {success ? (
            <div style={{ padding: "48px 32px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(78,205,196,0.15)", border: "2px solid var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Feedback received!</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.7 }}>
                Thank you for taking the time to share your thoughts.
              </div>
              <button
                className="btn btn-teal"
                onClick={() => { setSuccess(false); setBody(""); }}
                style={{ padding: "10px 24px", fontSize: 12 }}
              >
                Send Another
              </button>
            </div>
          ) : (
            <div style={{ padding: 24 }}>
              {/* Who's sending */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  {userChecked
                    ? user
                      ? <span style={{ color: "var(--teal)" }}>{user.username}</span>
                      : <span style={{ color: "var(--text-muted)" }}>Anonymous</span>
                    : <span style={{ color: "var(--text-faint)" }}>...</span>
                  }
                </span>
                {userChecked && !user && (
                  <button
                    onClick={() => router.push("/login")}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--teal)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                  >
                    Sign in to attach your name
                  </button>
                )}
              </div>

              {/* Textarea */}
              <textarea
                className="textarea-field"
                placeholder="Describe a bug, suggest a feature, or share anything on your mind..."
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={MAX}
                rows={7}
                style={{ resize: "vertical", minHeight: 140 }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSubmit(); }}
              />

              {/* Char counter */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 14 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-faint)" }}>
                  Ctrl+Enter to submit
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: body.length > MAX * 0.9 ? "var(--red)" : "var(--text-faint)" }}>
                  {body.length} / {MAX}
                </span>
              </div>

              {error && <div className="alert alert-error" style={{ marginBottom: 12, fontSize: 11 }}>{error}</div>}

              {/* Anon notice */}
              {userChecked && !user && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "rgba(78,205,196,0.06)", border: "1.5px solid rgba(78,205,196,0.25)", borderRadius: 8, marginBottom: 14 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6 }}>
                    You are not signed in. Your feedback will be submitted anonymously.
                  </span>
                </div>
              )}

              <button
                className="btn btn-teal"
                onClick={handleSubmit}
                disabled={submitting || body.trim().length === 0}
                style={{ width: "100%", padding: "13px", fontSize: 12, letterSpacing: "0.08em" }}
              >
                {submitting ? "SUBMITTING..." : "SUBMIT FEEDBACK"}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}