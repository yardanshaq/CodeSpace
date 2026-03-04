"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import { getCachedUser, setCachedUser } from "@/lib/authCache";

interface User {
  id: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

interface Snippet {
  id: string;
  title: string;
  filename: string;
  code: string;
  category: string;
  isPublic: boolean;
  views: number;
  admin: { username: string };
  attachments: { id: string; name: string; mimeType: string; size: number }[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ["AI", "Anime", "Converter", "Downloader", "Generator", "Other", "Random", "Scrape", "Search", "Tools", "Translate", "Uploader"];

export default function PostPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => {
    const c = getCachedUser();
    return c ? { id: c.id ?? "", username: c.username, role: c.role } : null;
  });
  const [loading, setLoading] = useState(!getCachedUser());

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [editSnippet, setEditSnippet] = useState<Snippet | null>(null);
  const [runSnippet, setRunSnippet] = useState<Snippet | null>(null);
  const [runOutput, setRunOutput] = useState("");
  const [runHasError, setRunHasError] = useState(false);
  const [runElapsed, setRunElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const [form, setForm] = useState({ title: "", code: "", category: "Scrape", isPublic: true });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [regForm, setRegForm] = useState({ username: "", password: "" });
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const outputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          setCachedUser(null);
          router.replace("/login");
          return;
        }
        const u = data.user as User;
        setUser(u);
        setCachedUser(u);
        setLoading(false);
      })
      .catch(() => router.replace("/login"));
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnippets = useCallback(async (silent = false) => {
    if (!silent) setSnippetsLoading(true);
    try {
      const res = await fetch(`/api/snippets?adminView=true&_=${Date.now()}`);
      const data = await res.json();
      if (!Array.isArray(data)) return;
      if (!silent) {
        setSnippets(data);
        setSnippetsLoading(false);
      } else {
        setSnippets(prev => {
          const prevMap = new Map(prev.map(s => [s.id, s]));
          const hasChanges =
            prev.length !== data.length ||
            data.some((s: Snippet) => {
              const old = prevMap.get(s.id);
              return !old || old.updatedAt !== s.updatedAt || old.views !== s.views;
            });
          if (!hasChanges) return prev;
          return data.map((s: Snippet) => {
            const existing = prevMap.get(s.id);
            if (existing && existing.updatedAt === s.updatedAt && existing.views === s.views) return existing;
            return s;
          });
        });
      }
    } catch { /* silent fail */ }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSnippets(false);
      pollRef.current = setInterval(() => fetchSnippets(true), 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, fetchSnippets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (showCreateModal) handleCreateSnippet();
        else if (showEditModal) handleEditSnippet();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateModal, showEditModal, form, editSnippet]);

  // Smart scroll: hanya scroll kalau output datang sedikit-sedikit (streaming lambat)
  // Output instant/besar sekaligus tidak di-scroll supaya user bisa baca dari atas
  const userScrolledUp = useRef(false);
  const prevOutputLen = useRef(0);

  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    userScrolledUp.current = false;
    prevOutputLen.current = 0;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrolledUp.current = !atBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [showRunModal]);

  useEffect(() => {
    const el = outputRef.current;
    if (!el || userScrolledUp.current) return;
    const delta = runOutput.length - prevOutputLen.current;
    prevOutputLen.current = runOutput.length;
    // Hanya scroll kalau delta kecil (streaming) — bukan dump besar sekaligus
    if (delta > 0 && delta < 300) {
      el.scrollTop = el.scrollHeight;
    }
  }, [runOutput]);

  const isMember = user?.role === "MEMBER";
  const isSuperAdmin = user?.role === "SUPERADMIN";

  const handleCreateSnippet = async () => {
    if (!form.title || !form.code) { setFormError("Title and code are required"); return; }
    setFormLoading(true); setFormError("");
    const res = await fetch("/api/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, isPublic: isMember ? true : form.isPublic }),
    });
    const data = await res.json();
    if (res.ok) {
      setFormSuccess("Snippet created!");
      setForm({ title: "", code: "", category: "Scrape", isPublic: true });
      setTimeout(() => { setShowCreateModal(false); setFormSuccess(""); fetchSnippets(true); }, 800);
    } else {
      setFormError(data.error || "Failed to create");
    }
    setFormLoading(false);
  };

  const handleEditSnippet = async () => {
    if (!editSnippet || !form.title || !form.code) { setFormError("Title and code required"); return; }
    setFormLoading(true); setFormError("");
    const res = await fetch(`/api/snippets/${editSnippet.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, isPublic: isMember ? true : form.isPublic }),
    });
    const data = await res.json();
    if (res.ok) {
      setFormSuccess("Snippet updated!");
      setTimeout(() => { setShowEditModal(false); setFormSuccess(""); setEditSnippet(null); fetchSnippets(true); }, 800);
    } else {
      setFormError(data.error || "Failed to update");
    }
    setFormLoading(false);
  };

  const handleDeleteSnippet = async (id: string) => {
    if (!confirm("Delete this snippet?")) return;
    const res = await fetch(`/api/snippets/${id}`, { method: "DELETE" });
    if (res.ok) fetchSnippets(true);
  };

  const openEdit = (s: Snippet) => {
    setEditSnippet(s);
    setForm({ title: s.title, code: s.code, category: s.category, isPublic: s.isPublic });
    setFormError(""); setFormSuccess(""); setShowEditModal(true);
  };

  const handleRegister = async () => {
    if (!regForm.username || !regForm.password) { setRegError("Fill all fields"); return; }
    setRegLoading(true); setRegError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regForm),
    });
    const data = await res.json();
    if (data.success) {
      setRegSuccess(`Account "${regForm.username}" created!`);
      setRegForm({ username: "", password: "" });
      setTimeout(() => { setShowRegisterModal(false); setRegSuccess(""); }, 1500);
    } else {
      setRegError(data.error || "Failed");
    }
    setRegLoading(false);
  };

  const handleRun = async (s: Snippet) => {
    setRunSnippet(s); setRunOutput(""); setRunHasError(false);
    setRunElapsed(0); setCopiedOutput(false); setRunning(true); setShowRunModal(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: s.code, snippetId: s.id }),
      });

      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find((l: string) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const ev = JSON.parse(dataLine.slice(6));
            if (ev.type === "done") {
              setRunElapsed(ev.elapsed || 0);
              setRunHasError(ev.hasError || false);
              setRunning(false);
            } else {
              setRunOutput(prev => prev ? prev + "\n" + ev.text : ev.text);
              if (ev.type === "error") setRunHasError(true);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      setRunOutput(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      setRunHasError(true);
      setRunning(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (loading) return <PageLoader label="loading dashboard" />;
  if (!user) return <PageLoader />;

  return (
    <>
      <Navbar />
      <main className="main">
        <button
          onClick={() => router.push("/")}
          className="btn btn-white"
          style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, padding: "7px 14px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          BACK
        </button>

        <div className="admin-header">
          <div>
            <div className="admin-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              {user.username.toUpperCase()}
            </div>
            <div className="admin-subtitle">Welcome back, {user.username}</div>
          </div>

          <div className="admin-actions">
            {isSuperAdmin && (
              <>
                <button className="btn btn-white btn-icon" onClick={() => router.push("/users")} title="Manage users">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </button>
                <button className="btn btn-yellow btn-icon" onClick={() => { setRegError(""); setRegSuccess(""); setRegForm({ username: "", password: "" }); setShowRegisterModal(true); }} title="Register new user">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </button>
              </>
            )}
            <button className="btn btn-teal btn-icon" onClick={() => { setForm({ title: "", code: "", category: "Scrape", isPublic: true }); setFormError(""); setFormSuccess(""); setShowCreateModal(true); }} title="New snippet">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {snippetsLoading ? (
          <PageLoader />
        ) : snippets.length === 0 ? (
          <div className="vault-empty">NO SNIPPETS YET. CLICK + TO POST YOUR FIRST SNIPPET.</div>
        ) : (
          <div className="snippets-list">
            {snippets.map((s) => (
              <div key={s.id} className="admin-snippet-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="admin-snippet-title">{s.title}</div>
                    <div className="admin-snippet-meta">
                      <span>{s.filename}</span>
                      <span>·</span>
                      <span className="snippet-category-badge" style={{ fontSize: 10, padding: "2px 8px" }}>{s.category.toUpperCase()}</span>
                      <span>·</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        {s.views}
                      </span>
                      <span>·</span>
                      <span>{formatDate(s.createdAt)}</span>
                      {isSuperAdmin && (<><span>·</span><span className="admin-by">by {s.admin.username}</span></>)}
                      {!isSuperAdmin && !isMember && s.admin.username !== user.username && (<><span>·</span><span className="admin-by">by {s.admin.username}</span></>)}
                    </div>
                  </div>
                  <span className={s.isPublic ? "badge-public" : "badge-private"}>
                    {s.isPublic ? "PUBLIC" : "PRIVATE"}
                  </span>
                </div>
                <div className="admin-snippet-actions">
                  <button className="btn btn-yellow" onClick={() => handleRun(s)}>▶ RUN</button>
                  <button className="btn btn-teal" onClick={() => openEdit(s)}>✎ EDIT</button>
                  <button className="btn btn-white" onClick={() => router.push(`/code?v=${s.filename}`)}>VIEW</button>
                  <button className="btn btn-red" onClick={() => handleDeleteSnippet(s.id)}>DELETE</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">CREATE NEW SNIPPET</span></div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}
              {formSuccess && <div className="alert alert-success">{formSuccess}</div>}
              <input type="text" className="input-field" placeholder="Snippet Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="form-row">
                <select className="select-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {!isMember ? (
                  <button className="toggle-btn" style={{ background: form.isPublic ? "#4ade80" : "#ddd", border: "2px solid var(--border-color)" }} onClick={() => setForm({ ...form, isPublic: !form.isPublic })}>
                    {form.isPublic ? "PUBLIC" : "PRIVATE"}
                  </button>
                ) : (
                  <span className="toggle-btn" style={{ background: "#4ade80", border: "2px solid var(--border-color)", cursor: "default", opacity: 0.7 }}>PUBLIC</span>
                )}
              </div>
              <textarea className="textarea-field" placeholder="Paste your code here..." value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-white" onClick={() => setShowCreateModal(false)}>CANCEL</button>
              <button className="btn btn-teal" onClick={handleCreateSnippet} disabled={formLoading} title="Ctrl+S">
                {formLoading ? "SAVING..." : "SAVE CODE"}{!formLoading && <span style={{ fontSize: 9, opacity: .5, marginLeft: 4 }}>Ctrl+S</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">EDIT SNIPPET</span></div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}
              {formSuccess && <div className="alert alert-success">{formSuccess}</div>}
              <input type="text" className="input-field" placeholder="Snippet Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="form-row">
                <select className="select-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {!isMember ? (
                  <button className="toggle-btn" style={{ background: form.isPublic ? "#4ade80" : "#ddd", border: "2px solid var(--border-color)" }} onClick={() => setForm({ ...form, isPublic: !form.isPublic })}>
                    {form.isPublic ? "PUBLIC" : "PRIVATE"}
                  </button>
                ) : (
                  <span className="toggle-btn" style={{ background: "#4ade80", border: "2px solid var(--border-color)", cursor: "default", opacity: 0.7 }}>PUBLIC</span>
                )}
              </div>
              <textarea className="textarea-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-white" onClick={() => setShowEditModal(false)}>CANCEL</button>
              <button className="btn btn-teal" onClick={handleEditSnippet} disabled={formLoading} title="Ctrl+S">
                {formLoading ? "SAVING..." : "SAVE CHANGES"}{!formLoading && <span style={{ fontSize: 9, opacity: .5, marginLeft: 4 }}>Ctrl+S</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MODAL */}
      {showRegisterModal && isSuperAdmin && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ paddingTop: 28, paddingBottom: 28 }}>
              <h2 className="modal-title" style={{ fontSize: 15, marginBottom: 4 }}>REGISTER NEW ACCOUNT</h2>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
                Account will be registered as MEMBER.
              </p>
              {regError && <div className="alert alert-error">{regError}</div>}
              {regSuccess && <div className="alert alert-success">{regSuccess}</div>}
              <input type="text" className="input-field" placeholder="Username" value={regForm.username} onChange={(e) => setRegForm({ ...regForm, username: e.target.value })} />
              <input type="password" className="input-field" placeholder="Password" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleRegister()} />
              <button className="btn btn-yellow" onClick={handleRegister} disabled={regLoading} style={{ width: "100%", padding: "14px", fontSize: "12px", letterSpacing: "0.08em", marginTop: 4 }}>
                {regLoading ? "CREATING..." : "CREATE ACCOUNT"}
              </button>
              <button className="close-link" onClick={() => setShowRegisterModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* RUN MODAL */}
      {showRunModal && runSnippet && (
        <div className="modal-overlay" onClick={() => setShowRunModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="modal-title">▶ RUN — {runSnippet.filename}</span>
              <button onClick={() => setShowRunModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <div
                ref={outputRef}
                className="run-output"
                style={{ color: runHasError ? "#ff6b6b" : "#4ade80", position: "relative", overflowY: "auto" }}
              >
                {runOutput || (running ? "" : "// No output")}
                {running && (
                  <span style={{ display: "inline-block", width: 8, height: 14, background: "#4ade80", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                )}
              </div>
              {running && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>⟳ Running on server...</div>
              )}
              {!running && runElapsed > 0 && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>✓ Executed in {runElapsed}ms</div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-white" onClick={() => { navigator.clipboard.writeText(runOutput); setCopiedOutput(true); setTimeout(() => setCopiedOutput(false), 2000); }} disabled={running}>
                {copiedOutput ? "✓ Copied!" : "⧉ Copy Output"}
              </button>
              <button className="btn btn-black" onClick={() => setShowRunModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  );
}