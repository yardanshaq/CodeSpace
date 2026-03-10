"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") || null;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.authenticated && data.user) {
          const role = data.user.role;
          if (callbackUrl)                                   router.replace(callbackUrl);
          else if (role === "SUPERADMIN" || role === "ADMIN") router.replace("/post");
          else                                               router.replace("/");
          return;
        }
      } catch { /* show form */ }
      finally  { setChecking(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (!username || !password) { setError("Please fill in all fields"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        const role = data.user.role;
        if (callbackUrl)                                   router.push(callbackUrl);
        else if (role === "SUPERADMIN" || role === "ADMIN") router.push("/post");
        else                                               router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch { setError("Connection error, please try again"); }
    setTimeout(() => setLoading(false), 1500);
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

  return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card">

          <div style={{ textAlign:"center", marginBottom:4 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:"var(--teal)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h1 className="login-title" style={{ marginBottom:6 }}>Sign In</h1>
            <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)" }}>
              New here?{" "}
              <a href="/register" style={{ color:"var(--teal)", textDecoration:"none", fontWeight:700 }}>Create an account</a>
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <input
            id="username" aria-label="Username"
            type="text" className="input-field"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          <input
            id="password" aria-label="Password"
            type="password" className="input-field"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />

          <div style={{ textAlign:"right", marginTop:-6 }}>
            <a href="/forgot-password" style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)", textDecoration:"none" }}
              onMouseOver={e => (e.currentTarget.style.color = "var(--teal)")}
              onMouseOut={e  => (e.currentTarget.style.color = "var(--text-faint)")}
            >
              Forgot password?
            </a>
          </div>

          <button
            className="btn btn-teal" onClick={handleLogin} disabled={loading}
            style={{ width:"100%", padding:"14px", fontSize:"13px", letterSpacing:"0.1em", color:"#000", marginTop:4 }}
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
          </button>

          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)" }}>
            <a href="/" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to home</a>
          </p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}