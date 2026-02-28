"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !password || !confirm) { setError("Please fill in all fields"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Account "${username}" created! Redirecting...`);
        setTimeout(() => router.push("/login"), 1500);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Connection error, please try again");
    }
    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">Create Account</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", marginBottom: 20, textAlign: "center" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 700 }}>Sign in</a>
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <input
            type="text"
            className="input-field"
            placeholder="Username (3–32 chars, letters/numbers/_)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              className="input-field"
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 44 }}
            />
            <button
              onClick={() => setShowPass((v) => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
            >
              {showPass ? "🙈" : "👁"}
            </button>
          </div>
          <input
            type={showPass ? "text" : "password"}
            className="input-field"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          />
          <button
            className="btn btn-teal"
            onClick={handleRegister}
            disabled={loading || !!success}
            style={{ width: "100%", padding: "14px", fontSize: "13px", letterSpacing: "0.1em" }}
          >
            {loading ? "CREATING..." : "CREATE ACCOUNT"}
          </button>
        </div>
      </div>
    </>
  );
}