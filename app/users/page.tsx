"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";

interface Admin {
  id: string;
  username: string;
  email: string | null;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
  createdAt: string;
  lastLoginAt: string | null;
  _count: { snippets: number };
}

type Modal = "none" | "add" | "edit" | "delete";

export default function UsersPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const [modal, setModal] = useState<Modal>("none");
  const [selected, setSelected] = useState<Admin | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Admin["role"]>("ADMIN");
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAdmins = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) { setAuthError(true); setLoading(false); return; }
      const data = await res.json();
      if (Array.isArray(data)) setAdmins(data);
      if (!silent) setLoading(false);
    } catch {
      if (!silent) setLoading(false);
    }
  }, []);

  // The first superadmin (oldest createdAt among SUPERADMIN role) — immutable
  const firstSuperadminId = admins
    .filter(a => a.role === "SUPERADMIN")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.id ?? null;

  useEffect(() => {
    fetchAdmins(false);
    pollRef.current = setInterval(() => fetchAdmins(true), 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAdmins]);

  const openAdd = () => {
    setUsername(""); setPassword(""); setFormError(""); setFormSuccess(""); setShowPass(false);
    setModal("add");
  };

  const openEdit = (a: Admin) => {
    setSelected(a); setUsername(a.username); setPassword(""); setEmail(a.email ?? ""); setRole(a.role); setFormError(""); setFormSuccess(""); setShowPass(false);
    setModal("edit");
  };

  const openDelete = (a: Admin) => {
    setSelected(a); setFormError(""); setModal("delete");
  };

  const closeModal = () => {
    setModal("none"); setSelected(null); setFormError(""); setFormSuccess("");
  };

  const handleAdd = async () => {
    if (!username || !password) { setFormError("All fields required"); return; }
    setFormLoading(true); setFormError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setFormSuccess(`Admin "${data.username}" created!`);
      await fetchAdmins(false);
      setTimeout(closeModal, 1200);
    } else {
      setFormError(data.error || "Failed");
    }
    setFormLoading(false);
  };

  const handleEdit = async () => {
    if (!selected) return;
    if (!username && !password) { setFormError("Enter a new username or password"); return; }
    setFormLoading(true); setFormError("");
    const res = await fetch(`/api/admin/users/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username !== selected.username ? username : undefined,
        password: password || undefined,
        email: email !== (selected.email ?? "") ? (email || null) : undefined,
        role: role !== selected.role ? role : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setFormSuccess("Updated!");
      await fetchAdmins(false);
      setTimeout(closeModal, 1200);
    } else {
      setFormError(data.error || "Failed");
    }
    setFormLoading(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setFormLoading(true); setFormError("");
    const res = await fetch(`/api/admin/users/${selected.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      await fetchAdmins(false);
      closeModal();
    } else {
      setFormError(data.error || "Failed");
    }
    setFormLoading(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return formatDate(d);
  };

  if (loading) return <PageLoader />;
  if (authError) return (<><Navbar /><main className="main"><div className="loading">ACCESS DENIED. SUPERADMIN ONLY.</div></main></>);

  const roleColor = (role: Admin["role"]) =>
    role === "SUPERADMIN" ? "var(--yellow)" : role === "ADMIN" ? "var(--teal)" : "var(--text-muted)";

  const AvatarCircle = ({ a }: { a: Admin }) => (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: roleColor(a.role),
      border: "2px solid var(--border-color)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 15, flexShrink: 0, color: "#000",
    }}>
      {a.username[0].toUpperCase()}
    </div>
  );

  const RoleBadge = ({ role }: { role: Admin["role"] }) => (
    <span style={{
      display: "inline-block",
      background: role === "SUPERADMIN" ? "var(--yellow)" : role === "ADMIN" ? "var(--teal)" : "var(--surface2)",
      color: role === "MEMBER" ? "var(--text-muted)" : "#000",
      border: "1.5px solid var(--border-color)", borderRadius: 6,
      padding: "2px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
    }}>
      {role === "SUPERADMIN" ? "★ SUPERADMIN" : role === "ADMIN" ? "ADMIN" : "MEMBER"}
    </span>
  );

  return (
    <>
      <Navbar />
      <main className="main">

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* BACK button — uses CSS class so it respects dark mode */}
            <button className="btn-back" onClick={() => router.back()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              BACK
            </button>
            <div>
              <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, fontStyle: "italic", color: "var(--text)" }}>
                Admin Users
              </h1>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {admins.length} account{admins.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <button
            className="btn btn-teal"
            onClick={openAdd}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            ADD ADMIN
          </button>
        </div>

        {/* Table — desktop */}
        <div className="users-table-wrap">
          <div className="users-table-head">
            <div>USERNAME</div>
            <div>ROLE</div>
            <div>SNIPPETS</div>
            <div>LAST LOGIN</div>
            <div style={{ textAlign: "right" }}>ACTIONS</div>
          </div>

          {admins.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              No admins found.
            </div>
          ) : (
            admins.map((a, idx) => (
              /* wrapper div gets class for nth-child stripe targeting */
              <div key={a.id} className={`users-row-wrap ${idx % 2 === 0 ? "row-odd" : "row-even"}`}>

                {/* Desktop row */}
                <div className="users-table-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AvatarCircle a={a} />
                    <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {a.username}
                    </span>
                  </div>
                  <div><RoleBadge role={a.role} /></div>
                  <div style={{ color: "var(--text-muted)" }}>{a._count.snippets}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {a.lastLoginAt ? (
                      <>
                        <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{formatRelative(a.lastLoginAt)}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatDate(a.lastLoginAt)}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>Never</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button className="btn btn-teal" onClick={() => openEdit(a)} style={{ padding: "6px 14px", fontSize: 11 }} >
                      ✎ EDIT
                    </button>
                    {a.role !== "SUPERADMIN" && (
                      <button className="btn btn-red" onClick={() => openDelete(a)} style={{ padding: "6px 14px", fontSize: 11 }}>
                        DELETE
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile card */}
                <div className="user-card">
                  <div className="user-card-top">
                    <AvatarCircle a={a} />
                    <div className="user-card-info">
                      <div className="user-card-name">{a.username}</div>
                      <div className="user-card-meta">
                        <RoleBadge role={a.role} />
                        <span>{a._count.snippets} snippet{a._count.snippets !== 1 ? "s" : ""}</span>
                        <span>{a.lastLoginAt ? formatRelative(a.lastLoginAt) : "Never logged in"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="user-card-actions">
                    <button className="btn btn-teal" onClick={() => openEdit(a)}>✎ EDIT</button>
                    {a.role !== "SUPERADMIN" && (
                      <button className="btn btn-red" onClick={() => openDelete(a)}>DELETE</button>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      </main>

      {/* ADD MODAL */}
      {modal === "add" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header"><span className="modal-title">ADD NEW ADMIN</span></div>
            <div className="modal-body">
              {formError && <div className="alert alert-error">{formError}</div>}
              {formSuccess && <div className="alert alert-success">{formSuccess}</div>}
              <label style={labelStyle}>Username</label>
              <input className="input-field" placeholder="min. 3 characters" value={username}
                onChange={e => setUsername(e.target.value)} autoFocus />
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input className="input-field" type={showPass ? "text" : "password"}
                  placeholder="min. 6 characters" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                  style={{ paddingRight: 44 }} />
                <button onClick={() => setShowPass(v => !v)} style={eyeBtn}>{showPass ? "🙈" : "👁"}</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-white" onClick={closeModal}>CANCEL</button>
              <button className="btn btn-teal" onClick={handleAdd} disabled={formLoading}>
                {formLoading ? "CREATING..." : "CREATE ADMIN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {modal === "edit" && selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header"><span className="modal-title">EDIT — {selected.username}</span></div>
            <div className="modal-body">
              {formError   && <div className="alert alert-error">{formError}</div>}
              {formSuccess && <div className="alert alert-success">{formSuccess}</div>}

              <label style={labelStyle}>Username</label>
              <input className="input-field" placeholder={selected.username} value={username}
                onChange={e => setUsername(e.target.value)} autoFocus />

              <label style={labelStyle}>
                Email <span style={{ color: "var(--text-faint)", fontSize: 11 }}>(for password recovery)</span>
              </label>
              <input className="input-field" type="email" placeholder="user@example.com" value={email}
                onChange={e => setEmail(e.target.value)} />

              <label style={labelStyle}>Role</label>
              <select className="input-field" value={role} onChange={e => setRole(e.target.value as Admin["role"])}
                disabled={selected.id === firstSuperadminId}>
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPERADMIN">SUPERADMIN</option>
              </select>
              {selected.id === firstSuperadminId && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", marginTop: -4 }}>
                  The original superadmin role cannot be changed
                </div>
              )}

              <label style={labelStyle}>
                New Password <span style={{ color: "var(--text-faint)", fontSize: 11 }}>(leave blank to keep)</span>
              </label>
              <div style={{ position: "relative" }}>
                <input className="input-field" type={showPass ? "text" : "password"}
                  placeholder="min. 6 characters" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleEdit()}
                  style={{ paddingRight: 44 }} />
                <button onClick={() => setShowPass(v => !v)} style={eyeBtn}>{showPass ? "🙈" : "👁"}</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-white" onClick={closeModal}>CANCEL</button>
              <button className="btn btn-teal" onClick={handleEdit} disabled={formLoading}>
                {formLoading ? "SAVING..." : "SAVE CHANGES"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {modal === "delete" && selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header"><span className="modal-title">DELETE ADMIN</span></div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              {formError && <div className="alert alert-error">{formError}</div>}
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                Delete admin <strong>{selected.username}</strong>?<br />
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  This will also delete their {selected._count.snippets} snippet{selected._count.snippets !== 1 ? "s" : ""}.
                </span>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-white" onClick={closeModal}>CANCEL</button>
              <button className="btn btn-red" onClick={handleDelete} disabled={formLoading}>
                {formLoading ? "DELETING..." : "YES, DELETE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  marginBottom: 6,
  marginTop: 12,
  color: "var(--text)",
};

const eyeBtn: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
};