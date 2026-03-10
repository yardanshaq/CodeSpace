"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [checking,  setChecking]  = useState(true);
  const [valid,     setValid]     = useState(false);
  const [username,  setUsername]  = useState("");
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(d => { setValid(d.valid); if (d.username) setUsername(d.username); })
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const handleReset = async () => {
    if (!password || !confirm) { setError("Please fill in all fields"); return; }
    if (password !== confirm)  { setError("Passwords do not match"); return; }
    if (password.length < 6)   { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setError(data.error || "Reset failed");
      }
    } catch { setError("Connection error, please try again"); }
    setLoading(false);
  };

  if (checking) return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card" style={{ alignItems:"center", justifyContent:"center", minHeight:180 }}>
          <div style={{ display:"flex", gap:8 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ width:8, height:8, borderRadius:"50%", background:"var(--teal)", display:"inline-block", animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }}/>
            ))}
          </div>
          <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-8px);opacity:1}}`}</style>
        </div>
      </div>
    </>
  );

  if (!valid) return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card" style={{ textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>⚠️</div>
          <h1 className="login-title" style={{ marginBottom:8 }}>Invalid Link</h1>
          <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)", marginBottom:20 }}>
            This reset link is invalid or has expired. Links expire after 30 minutes.
          </p>
          <a href="/forgot-password" className="btn btn-teal"
            style={{ display:"block", padding:"12px", fontSize:"12px", letterSpacing:"0.1em", color:"#000", textDecoration:"none", textAlign:"center" }}>
            REQUEST NEW LINK
          </a>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card">

          <div style={{ textAlign:"center", marginBottom:4 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:"var(--teal)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h1 className="login-title" style={{ marginBottom:6 }}>New Password</h1>
            {username && (
              <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)" }}>
                Setting new password for <strong style={{ color:"var(--teal)" }}>{username}</strong>
              </p>
            )}
          </div>

          {!done ? (
            <>
              {error && <div className="alert alert-error">{error}</div>}

              <input
                type="password" className="input-field"
                placeholder="New password (min. 6 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <input
                type="password" className="input-field"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
              />

              <button
                className="btn btn-teal" onClick={handleReset} disabled={loading}
                style={{ width:"100%", padding:"14px", fontSize:"13px", letterSpacing:"0.1em", color:"#000", marginTop:4 }}
              >
                {loading ? "UPDATING..." : "SET NEW PASSWORD"}
              </button>
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"8px 0" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
              <p style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--teal)", fontWeight:700, marginBottom:6 }}>
                Password updated!
              </p>
              <p style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)" }}>
                Redirecting to login...
              </p>
            </div>
          )}

          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)" }}>
            <a href="/login" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to login</a>
          </p>
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}