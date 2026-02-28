"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";

interface User {
  id: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) { router.push("/login"); return; }
        setUser(data.user);
        setNewUsername(data.user.username);
        setLoading(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!currentPassword) { setError("Current password is required"); return; }
    if (newPassword && newPassword !== confirmPassword) { setError("New passwords do not match"); return; }
    if (newPassword && newPassword.length < 8) { setError("New password must be at least 8 characters"); return; }

    const payload: Record<string, string> = { currentPassword };
    if (newUsername !== user?.username) payload.newUsername = newUsername;
    if (newPassword) payload.newPassword = newPassword;

    if (Object.keys(payload).length === 1) { setError("No changes to save"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Settings saved! Refreshing...");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setUser(data.user);
        setTimeout(() => { setSuccess(""); router.refresh(); }, 1500);
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Connection error");
    }
    setSaving(false);
  };

  if (loading) return <PageLoader label="loading settings" />;

  return (
    <>
      <Navbar />
      <main className="main" style={{ maxWidth: 480, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, letterSpacing: "0.06em", margin: 0 }}>
            SETTINGS
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Logged in as{" "}
            <span style={{
              fontWeight: 700,
              color: user?.role === "SUPERADMIN" ? "var(--yellow)" : user?.role === "ADMIN" ? "var(--teal)" : "var(--text)",
            }}>
              {user?.username}
            </span>
            {" "}·{" "}
            <span style={{ textTransform: "uppercase", fontSize: 10 }}>{user?.role}</span>
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        <div style={{
          background: "var(--card-bg)",
          border: "1.5px solid var(--border-color)",
          borderRadius: 10,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}>
          <div>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              USERNAME
            </label>
            <input
              type="text"
              className="input-field"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ height: 1, background: "var(--border-color)" }} />

          <div>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              NEW PASSWORD <span style={{ fontWeight: 400, opacity: 0.6 }}>(leave blank to keep current)</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                className="input-field"
                placeholder="New password (min. 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ marginBottom: 8, paddingRight: 44 }}
              />
              <button onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 12, top: 13, background: "none", border: "none", cursor: "pointer", fontSize: 15, opacity: 0.7 }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
            <input
              type={showPass ? "text" : "password"}
              className="input-field"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ height: 1, background: "var(--border-color)" }} />

          <div>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              CURRENT PASSWORD <span style={{ color: "#ff6b6b" }}>*</span>
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Required to save any changes"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button className="btn btn-white" onClick={() => router.back()} disabled={saving}>
              CANCEL
            </button>
            <button className="btn btn-teal" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
              {saving ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
          Saving changes will invalidate all active sessions and log you in again automatically.
        </p>
      </main>
    </>
  );
}