"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleRegister = async () => {
    if (!username || !password || !confirm) { setError("Please fill in all fields"); return; }
    if (password !== confirm)               { setError("Passwords do not match"); return; }
    if (password.length < 6)               { setError("Password must be at least 6 characters"); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Invalid email address"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email: email || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Account "${username}" created! Redirecting...`);
        setTimeout(() => router.push("/login"), 1500);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch { setError("Connection error, please try again"); }
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card">

          <div style={{ textAlign:"center", marginBottom:4 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:"var(--teal)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h1 className="login-title" style={{ marginBottom:6 }}>Create Account</h1>
            <p style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-muted)" }}>
              Already have an account?{" "}
              <a href="/login" style={{ color:"var(--teal)", textDecoration:"none", fontWeight:700 }}>Sign in</a>
            </p>
          </div>

          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <input
            aria-label="Username"
            type="text" className="input-field"
            placeholder="Username (3–32 chars)"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />

          {/* Email — optional */}
          <div>
            <input
              aria-label="Email"
              type="email" className="input-field"
              placeholder="Email (optional — for password recovery)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <p style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-faint)", marginTop:5, marginBottom:0 }}>
              Without an email you won&apos;t be able to reset your password if you forget it.
            </p>
          </div>

          <input
            aria-label="Password"
            type="password" className="input-field"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <input
            aria-label="Confirm Password"
            type="password" className="input-field"
            placeholder="Confirm Password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleRegister()}
          />

          <button
            className="btn btn-teal" onClick={handleRegister}
            disabled={loading || !!success}
            style={{ width:"100%", padding:"14px", fontSize:"13px", letterSpacing:"0.1em", color:"#000", marginTop:4 }}
          >
            {loading ? "CREATING..." : "CREATE ACCOUNT"}
          </button>

          <p style={{ textAlign:"center", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-faint)" }}>
            <a href="/" style={{ color:"var(--text-muted)", textDecoration:"none" }}>← Back to home</a>
          </p>
        </div>
      </div>
    </>
  );
}