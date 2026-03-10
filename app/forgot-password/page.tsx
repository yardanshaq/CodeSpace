"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";

type State = "idle" | "not_found" | "no_email" | "sent" | "rate_limited";

export default function ForgotPasswordPage() {
  const [username,    setUsername]    = useState("");
  const [loading,     setLoading]     = useState(false);
  const [state,       setState]       = useState<State>("idle");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error,       setError]       = useState("");

  const handleSubmit = async () => {
    if (!username) { setError("Please enter your username"); return; }
    setLoading(true); setError(""); setState("idle");
    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (res.status === 429) { setState("rate_limited"); setLoading(false); return; }

      const data = await res.json();
      if      (data.notFound)   setState("not_found");
      else if (data.noEmail)    setState("no_email");
      else if (data.success)  {
        if (data.maskedEmail) setMaskedEmail(data.maskedEmail);
        setState("sent");
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Connection error, please try again");
    }
    setLoading(false);
  };

  const reset = () => { setState("idle"); setError(""); setMaskedEmail(""); };

  // ── Shared card header ──────────────────────────────────────────────────
  const Header = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
    <div style={{ textAlign:"center", marginBottom:4 }}>
      <div style={{ width:48, height:48, borderRadius:12, background:"var(--teal)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
        {icon}
      </div>
      <h1 className="login-title" style={{ marginBottom:6 }}>{title}</h1>
      {subtitle && <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)" }}>{subtitle}</p>}
    </div>
  );

  const lockIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );

  // ── STATE: rate limited ─────────────────────────────────────────────────
  if (state === "rate_limited") return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card" style={{ textAlign:"center" }}>
          <Header icon={lockIcon} title="Slow down" />
          <div style={{ background:"color-mix(in srgb, #f5c542 8%, transparent)", border:"1.5px solid color-mix(in srgb, #f5c542 25%, transparent)", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
            <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"#f5c542", margin:0, lineHeight:1.7 }}>
              Too many attempts. Please wait a few minutes before trying again.
            </p>
          </div>
          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)" }}>
            <a href="/login" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to login</a>
          </p>
        </div>
      </div>
    </>
  );

  // ── STATE: username not found ───────────────────────────────────────────
  if (state === "not_found") return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card" style={{ textAlign:"center" }}>
          <Header icon={lockIcon} title="Not found" />
          <div style={{ background:"color-mix(in srgb, #f25c54 8%, transparent)", border:"1.5px solid color-mix(in srgb, #f25c54 25%, transparent)", borderRadius:10, padding:"14px 16px" }}>
            <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"#f25c54", margin:0, lineHeight:1.7 }}>
              No account found with username <strong style={{ color:"var(--text)" }}>&ldquo;{username}&rdquo;</strong>.
              <br/>Double-check and try again.
            </p>
          </div>
          <button className="btn btn-white" onClick={reset}
            style={{ width:"100%", padding:"12px", fontSize:"12px", letterSpacing:"0.08em", marginTop:4 }}>
            TRY AGAIN
          </button>
          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)" }}>
            <a href="/login" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to login</a>
          </p>
        </div>
      </div>
    </>
  );

  // ── STATE: no email linked ──────────────────────────────────────────────
  if (state === "no_email") return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card" style={{ textAlign:"center" }}>
          <Header icon={lockIcon} title="No email linked" />
          <div style={{ background:"color-mix(in srgb, #f5c542 8%, transparent)", border:"1.5px solid color-mix(in srgb, #f5c542 25%, transparent)", borderRadius:10, padding:"14px 16px" }}>
            <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"#f5c542", margin:"0 0 8px", lineHeight:1.7 }}>
              Account <strong style={{ color:"var(--text)" }}>&ldquo;{username}&rdquo;</strong> has no email address linked.
            </p>
            <p style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)", margin:0, lineHeight:1.7 }}>
              <a href="/login" style={{ color:"var(--teal)", textDecoration:"none", fontWeight:700 }}>Sign in</a>
              {" "}and go to <strong>Settings → Email</strong> to add one for future recovery.
            </p>
          </div>
          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)" }}>
            <a href="/login" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to login</a>
          </p>
        </div>
      </div>
    </>
  );

  // ── STATE: email sent ───────────────────────────────────────────────────
  if (state === "sent") return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card" style={{ textAlign:"center" }}>
          <div style={{ width:52, height:52, borderRadius:12, background:"color-mix(in srgb, var(--teal) 12%, transparent)", border:"1.5px solid color-mix(in srgb, var(--teal) 30%, transparent)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h1 className="login-title" style={{ marginBottom:8 }}>Email sent</h1>
          {maskedEmail ? (
            <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", lineHeight:1.8, marginBottom:0 }}>
              A reset link was sent to{" "}
              <span style={{ color:"var(--teal)", fontWeight:700 }}>{maskedEmail}</span>.
              <br/>The link expires in <span style={{ color:"#f5c542", fontWeight:700 }}>30 minutes</span>.
              <br/><span style={{ color:"var(--text-faint)", fontSize:11 }}>Check your spam folder if you don&apos;t see it.</span>
            </p>
          ) : (
            <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", lineHeight:1.8 }}>
              If an account with that username has an email on file, a reset link has been sent.
              <br/>The link expires in <span style={{ color:"#f5c542", fontWeight:700 }}>30 minutes</span>.
            </p>
          )}
          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)", marginTop:8 }}>
            <a href="/login" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to login</a>
          </p>
        </div>
      </div>
    </>
  );

  // ── STATE: idle (default form) ──────────────────────────────────────────
  return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card">
          <Header
            icon={lockIcon}
            title="Forgot Password"
            subtitle="Enter your username and we'll send a reset link to your email."
          />

          {error && <div className="alert alert-error">{error}</div>}

          <input
            type="text" className="input-field"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            autoFocus
          />

          <button
            className="btn btn-teal" onClick={handleSubmit} disabled={loading}
            style={{ width:"100%", padding:"14px", fontSize:"13px", letterSpacing:"0.1em", color:"#000", marginTop:4 }}
          >
            {loading ? "CHECKING..." : "SEND RESET LINK"}
          </button>

          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)" }}>
            <a href="/login" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to login</a>
          </p>
        </div>
      </div>
    </>
  );
}