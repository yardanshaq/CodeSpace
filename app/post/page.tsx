"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNavigate } from "@/components/NavigationLoader";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";
import { getCachedUser, setCachedUser } from "@/lib/authCache";

interface User {
  id: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

interface SnippetFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy?: string;
}

interface Snippet {
  id: string;
  title: string;
  filename: string;
  code: string;
  category: string;
  isPublic: boolean;
  views: number;
  likeCount: number;
  commentCount: number;
  admin: { username: string };
  attachments: SnippetFile[];
  createdAt: string;
  updatedAt: string;
}

// ── Category color map ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  AI:         { bg: "#f5c542", text: "#000" },
  Anime:      { bg: "#f472b6", text: "#000" },
  Converter:  { bg: "#60a5fa", text: "#000" },
  Downloader: { bg: "#f25c54", text: "#fff" },
  Generator:  { bg: "#a78bfa", text: "#000" },
  Other:      { bg: "#94a3b8", text: "#000" },
  Random:     { bg: "#fb923c", text: "#000" },
  Scrape:     { bg: "#4ecdc4", text: "#000" },
  Search:     { bg: "#818cf8", text: "#fff" },
  Tools:      { bg: "#4ade80", text: "#000" },
  Translate:  { bg: "#34d399", text: "#000" },
  Uploader:   { bg: "#f97316", text: "#fff" },
};

function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "var(--teal)", text: "#000" };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileMimeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "IMG";
  if (mimeType.startsWith("video/")) return "VID";
  if (mimeType.startsWith("audio/")) return "AUD";
  if (mimeType.startsWith("text/")) return "TXT";
  if (mimeType.includes("json")) return "JSON";
  if (mimeType.includes("pdf")) return "PDF";
  return "FILE";
}

const CATEGORIES = ["AI", "Anime", "Converter", "Downloader", "Generator", "Other", "Random", "Scrape", "Search", "Tools", "Translate", "Uploader"];

export default function PostPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const c = getCachedUser();
    return c ? { id: (c as User).id ?? "", username: c.username, role: c.role } : null;
  });
  const [loading, setLoading] = useState(!getCachedUser());

  const [snippets, setSnippets]           = useState<Snippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [showRunModal, setShowRunModal]       = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void; confirmLabel?: string;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDialog({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const [editSnippet, setEditSnippet] = useState<Snippet | null>(null);
  const [runSnippet, setRunSnippet]   = useState<Snippet | null>(null);
  const [runOutput, setRunOutput]     = useState("");
  const [runImages, setRunImages]     = useState<{ name: string; mime: string; data: string }[]>([]);
  const [runHasError, setRunHasError] = useState(false);
  const [runElapsed, setRunElapsed]   = useState(0);
  const [running, setRunning]         = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const runAbortRef = useRef<AbortController | null>(null);

  const [form, setForm] = useState({ title: "", code: "", category: "Scrape", isPublic: true });
  const [formError, setFormError]     = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [regForm, setRegForm]     = useState({ username: "", password: "" });
  const [regError, setRegError]   = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [editFiles, setEditFiles]       = useState<SnippetFile[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError]       = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [createPendingFiles, setCreatePendingFiles] = useState<{ file: File; id: string }[]>([]);
  const [createFileError, setCreateFileError]       = useState("");
  const [createUploadProgress, setCreateUploadProgress] = useState<{ current: number; total: number; pct: number } | null>(null);
  const [createUploadError, setCreateUploadError]   = useState("");
  const createFileInputRef = useRef<HTMLInputElement | null>(null);

  const outputRef = useRef<HTMLDivElement | null>(null);
  const snippetRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const listRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch("/api/auth/me", { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!data.authenticated) { setCachedUser(null); setLoading(false); router.replace("/login"); return; }
        const u = data.user as User;
        setUser(u); setCachedUser(u); setLoading(false);
      })
      .catch(() => { setLoading(false); router.replace("/login"); })
      .finally(() => clearTimeout(timeout));
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnippets = useCallback(async (silent = false) => {
    if (!silent) setSnippetsLoading(true);
    try {
      const res  = await fetch(`/api/snippets?adminView=true`);
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
              return (
                !old ||
                old.updatedAt !== s.updatedAt ||
                old.views !== s.views ||
                old.likeCount !== s.likeCount ||
                old.commentCount !== s.commentCount
              );
            });
          if (!hasChanges) return prev;
          return data.map((s: Snippet) => {
            const existing = prevMap.get(s.id);
            if (
              existing &&
              existing.updatedAt === s.updatedAt &&
              existing.views === s.views &&
              existing.likeCount === s.likeCount &&
              existing.commentCount === s.commentCount
            ) return existing;
            return s;
          });
        });
      }
    } catch { /* silent fail */ }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSnippets(false);
      pollRef.current = setInterval(() => fetchSnippets(true), 10000);
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

  useEffect(() => {
    if (showRunModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [showRunModal]);

  const userScrolledUp = useRef(false);
  const prevOutputLen  = useRef(0);

  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    userScrolledUp.current = false;
    prevOutputLen.current  = 0;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      userScrolledUp.current = !atBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [showRunModal]);

  // Show scroll-to-top button when user scrolls down
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = outputRef.current;
    if (!el || userScrolledUp.current) return;
    const delta = runOutput.length - prevOutputLen.current;
    prevOutputLen.current = runOutput.length;
    if (delta > 0 && delta < 300) el.scrollTop = el.scrollHeight;
  }, [runOutput]);

  // Fade-in cards saat muncul di viewport — re-trigger setiap scroll masuk/keluar
  useEffect(() => {
    if (!listRef.current) return;
    const cards = listRef.current.querySelectorAll<HTMLElement>(".admin-snippet-card");
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    // Set semua ke hidden dulu
    cards.forEach(c => {
      c.style.transition = "none";
      c.style.opacity = "0";
      c.style.transform = "translateY(14px)";
    });
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        const idx = Array.from(cards).indexOf(el);
        if (entry.isIntersecting) {
          // Card masuk viewport — fade in, stagger kecil & di-cap supaya tidak lambat saat scroll cepat
          const delay = Math.min(idx % 5 * 30, 80);
          const t = setTimeout(() => {
            el.style.transition = "opacity 0.25s ease, transform 0.25s ease";
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }, delay);
          timers.set(el, t);
        } else {
          // Card keluar viewport — reset
          clearTimeout(timers.get(el));
          timers.delete(el);
          el.style.transition = "none";
          el.style.opacity = "0";
          el.style.transform = "translateY(14px)";
        }
      });
    }, { threshold: 0.06 });
    cards.forEach(c => obs.observe(c));
    return () => { obs.disconnect(); timers.forEach(t => clearTimeout(t)); };
  }, [snippets]);

  const isMember    = user?.role === "MEMBER";
  const isSuperAdmin = user?.role === "SUPERADMIN";

  const handleCreateSnippet = async () => {
    if (!form.title || !form.code) { setFormError("Title and code are required"); return; }
    setFormLoading(true); setFormError(""); setCreateUploadError(""); setCreateUploadProgress(null);

    let snippetId: string | null = null;
    try {
      const res  = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isPublic: isMember ? true : form.isPublic }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Failed to create"); setFormLoading(false); return; }
      snippetId = data.id;
    } catch { setFormError("Network error, please try again"); setFormLoading(false); return; }

    if (createPendingFiles.length > 0 && snippetId) {
      const total  = createPendingFiles.length;
      const errors: string[] = [];
      for (let i = 0; i < total; i++) {
        const { file } = createPendingFiles[i];
        setCreateUploadProgress({ current: i + 1, total, pct: 0 });
        const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const fd  = new FormData();
          fd.append("file", file);
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `/api/snippets/${snippetId}/files`);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable)
              setCreateUploadProgress({ current: i + 1, total, pct: Math.round((ev.loaded / ev.total) * 100) });
          };
          xhr.onload = () => {
            if (xhr.status === 413) { resolve({ ok: false, error: "File too large for server (max ~4 MB on this plan)" }); return; }
            try {
              const body = JSON.parse(xhr.responseText);
              resolve(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, error: body.error || `Upload failed (${xhr.status})` });
            } catch { resolve({ ok: false, error: `Upload failed (${xhr.status})` }); }
          };
          xhr.onerror = () => resolve({ ok: false, error: "Network error" });
          xhr.send(fd);
        });
        if (!result.ok) errors.push(`"${file.name}": ${result.error}`);
      }
      setCreateUploadProgress(null);
      setCreatePendingFiles([]);
      setFormLoading(false);
      if (errors.length > 0) {
        setCreateUploadError(errors.join(" · "));
        setFormSuccess("Snippet created! Some files failed to upload.");
        setTimeout(() => { setShowCreateModal(false); setFormSuccess(""); fetchSnippets(true); }, 2500);
        return;
      }
    } else {
      setFormLoading(false);
    }

    setFormSuccess("Snippet created!");
    setForm({ title: "", code: "", category: "Scrape", isPublic: true });
    setTimeout(() => { setShowCreateModal(false); setFormSuccess(""); fetchSnippets(false); }, 400);
  };

  const handleEditSnippet = async () => {
    if (!editSnippet || !form.title || !form.code) { setFormError("Title and code required"); return; }
    setFormLoading(true); setFormError("");
    const res  = await fetch(`/api/snippets/${editSnippet.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, isPublic: isMember ? true : form.isPublic }),
    });
    const data = await res.json();
    if (res.ok) {
      setFormSuccess("Snippet updated!");
      const savedId = editSnippet!.id;
      // Capture scroll position BEFORE closing modal
      const scrollY = window.scrollY;
      setSnippets(prev => prev.map(s => s.id === savedId ? { ...s, title: form.title, code: form.code, category: form.category, isPublic: form.isPublic, updatedAt: new Date().toISOString() } : s));
      setTimeout(() => {
        setShowEditModal(false); setFormSuccess(""); setEditSnippet(null);
        // Restore scroll position immediately after modal closes
        window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
        // Then smooth scroll to the card
        setTimeout(() => {
          const el = snippetRefs.current.get(savedId);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          // Silent fetch — won't reset scroll
          fetchSnippets(true);
        }, 80);
      }, 400);
    } else {
      setFormError(data.error || "Failed to update");
    }
    setFormLoading(false);
  };

  const handleDeleteSnippet = async (id: string) => {
    showConfirm("DELETE SNIPPET", "This snippet will be permanently deleted. This action cannot be undone.", async () => {
      closeConfirm();
      const res = await fetch(`/api/snippets/${id}`, { method: "DELETE" });
      if (res.ok) fetchSnippets(true);
    });
  };

  const openEdit = (s: Snippet) => {
    setEditSnippet(s);
    setForm({ title: s.title, code: s.code, category: s.category, isPublic: s.isPublic });
    setFormError(""); setFormSuccess("");
    setEditFiles(s.attachments ?? []);
    setFileError("");
    setShowEditModal(true);
  };

  const handleCreateFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (createFileInputRef.current) createFileInputRef.current.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setCreateFileError("File too large. Maximum 4 MB per file."); return; }
    setCreateFileError("");
    const id = Math.random().toString(36).slice(2);
    setCreatePendingFiles(prev => {
      const idx = prev.findIndex(f => f.file.name === file.name);
      if (idx >= 0) { const next = [...prev]; next[idx] = { file, id }; return next; }
      return [...prev, { file, id }];
    });
  };

  const handleCreateFileRemove = (id: string) =>
    setCreatePendingFiles(prev => prev.filter(f => f.id !== id));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editSnippet) return;
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setFileError("File too large. Maximum 4 MB per file."); return; }
    setFileUploading(true); setUploadProgress(0); setFileError("");
    const fd  = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/snippets/${editSnippet.id}/files`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 413) { setFileError("File too large — server rejected it. Try a file under 4 MB."); setFileUploading(false); setUploadProgress(0); return; }
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setEditFiles(prev => {
            const exists = prev.findIndex(f => f.name === data.name);
            if (exists >= 0) { const next = [...prev]; next[exists] = data; return next; }
            return [...prev, data];
          });
        } else { setFileError(data.error || "Upload failed"); }
      } catch { setFileError(`Upload failed (status ${xhr.status})`); }
      setFileUploading(false); setUploadProgress(0);
    };
    xhr.onerror = () => { setFileError("Network error during upload"); setFileUploading(false); setUploadProgress(0); };
    xhr.send(fd);
  };

  const handleFileDelete = async (fileId: string) => {
    if (!editSnippet) return;
    showConfirm("DELETE FILE", "This file will be permanently removed from the snippet.", async () => {
      closeConfirm();
      const res = await fetch(`/api/snippets/${editSnippet!.id}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      if (res.ok) setEditFiles(prev => prev.filter(f => f.id !== fileId));
      else { const data = await res.json(); setFileError(data.error || "Failed to delete file"); }
    });
  };

  const handleRegister = async () => {
    if (!regForm.username || !regForm.password) { setRegError("Fill all fields"); return; }
    setRegLoading(true); setRegError("");
    const res  = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regForm),
    });
    const data = await res.json();
    if (data.success) {
      setRegSuccess(`Account "${regForm.username}" created!`);
      setRegForm({ username: "", password: "" });
      setTimeout(() => { setShowRegisterModal(false); setRegSuccess(""); }, 1500);
    } else { setRegError(data.error || "Failed"); }
    setRegLoading(false);
  };

  const handleRun = async (s: Snippet) => {
    // If running the snippet currently being edited, use the live form code
    const effectiveSnippet = (editSnippet && editSnippet.id === s.id)
      ? { ...s, code: form.code }
      : s;
    setRunSnippet(effectiveSnippet); setRunOutput(""); setRunImages([]); setRunHasError(false);
    setRunElapsed(0); setCopiedOutput(false); setRunning(true); setShowRunModal(true);
    const abortCtrl = new AbortController();
    runAbortRef.current = abortCtrl;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: effectiveSnippet.code, snippetId: effectiveSnippet.id }),
        signal: abortCtrl.signal,
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
            if (ev.type === "done") { setRunElapsed(ev.elapsed || 0); setRunHasError(ev.hasError || false); setRunning(false); }
            else if (ev.type === "image") { setRunImages(prev => [...prev, { name: ev.name, mime: ev.mime, data: ev.data }]); }
            else { setRunOutput(prev => prev ? prev + "\n" + ev.text : ev.text); if (ev.type === "error") setRunHasError(true); }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setRunOutput(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        setRunHasError(true);
      }
      setRunning(false);
    } finally { runAbortRef.current = null; }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (loading) return <PageLoader />;
  if (!user)   return <PageLoader />;

  return (
    <>
      <Navbar />
      <main className="main">
        <button
          onClick={() => router.push("/")}
          className="btn btn-white"
          aria-label="Back to home"
          style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, padding: "7px 14px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          BACK
        </button>

        <div className="admin-header">
          <div>
            <h1 className="admin-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              {user.username.toUpperCase()}
            </h1>
            <div className="admin-subtitle">Welcome back, {user.username}</div>
          </div>

          <div className="admin-actions">
            {isSuperAdmin && (
              <>
                <button className="btn btn-white btn-icon" onClick={() => router.push("/users")} title="Manage users" aria-label="Manage users">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </button>
                <button className="btn btn-white btn-icon" onClick={() => router.push("/feedback/inbox")} title="Feedback inbox" aria-label="Feedback inbox">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
                <button
                  className="btn btn-yellow btn-icon"
                  onClick={() => { setRegError(""); setRegSuccess(""); setRegForm({ username: "", password: "" }); setShowRegisterModal(true); }}
                  title="Register new user"
                  aria-label="Register new user"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </button>
              </>
            )}
            <button
              className="btn btn-teal btn-icon"
              onClick={() => { setForm({ title: "", code: "", category: "Scrape", isPublic: true }); setFormError(""); setFormSuccess(""); setCreatePendingFiles([]); setCreateFileError(""); setShowCreateModal(true); }}
              title="New snippet"
              aria-label="Create new snippet"
            >
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
          <div className="snippets-list" ref={listRef}>
            {snippets.map((s) => {
              const catStyle = getCategoryStyle(s.category);
              return (
                <div key={s.id} className="admin-snippet-card" ref={el => { if (el) snippetRefs.current.set(s.id, el); else snippetRefs.current.delete(s.id); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="admin-snippet-title">{s.title}</div>
                      <div className="admin-snippet-meta">
                        <span>{s.filename}</span>
                        <span>·</span>
                        {/* Colored category badge */}
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px", borderRadius: 4,
                          background: catStyle.bg, color: catStyle.text,
                          fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
                          letterSpacing: "0.08em", border: "1.5px solid var(--border-color)",
                        }}>
                          {s.category.toUpperCase()}
                        </span>
                        <span>·</span>
                        {/* views */}
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          {s.views}
                        </span>
                        {/* likes */}
                        <span>·</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                          {s.likeCount ?? 0}
                        </span>
                        {/* comments */}
                        {(s.commentCount ?? 0) > 0 && (
                          <>
                            <span>·</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                              </svg>
                              {s.commentCount}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>{formatDate(s.createdAt)}</span>
                        {isSuperAdmin && (<><span>·</span><span className="admin-by">by {s.admin.username}</span></>)}
                        {!isSuperAdmin && !isMember && s.admin.username !== user.username && (<><span>·</span><span className="admin-by">by {s.admin.username}</span></>)}
                      </div>
                    </div>
                    <span className={s.isPublic ? "badge-public" : "badge-private"} style={{ flexShrink: 0, marginLeft: 10 }}>
                      {s.isPublic ? "PUBLIC" : "PRIVATE"}
                    </span>
                  </div>
                  <div className="admin-snippet-actions">
                    <button className="btn btn-yellow" onClick={() => handleRun(s)} aria-label={`Run ${s.title}`}>RUN</button>
                    <button className="btn btn-teal"   onClick={() => openEdit(s)} aria-label={`Edit ${s.title}`}>EDIT</button>
                    <button className="btn btn-white"  onClick={() => navigate(`/code?v=${s.filename}`)} aria-label={`View ${s.title}`}>VIEW</button>
                    <button className="btn btn-red"    onClick={() => handleDeleteSnippet(s.id)} aria-label={`Delete ${s.title}`}>DELETE</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">CREATE NEW SNIPPET</span></div>
            <div className="modal-body">
              {formError   && <div className="alert alert-error">{formError}</div>}
              {formSuccess && <div className="alert alert-success">{formSuccess}</div>}
              <input type="text" className="input-field" placeholder="Snippet Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="form-row">
                <select className="select-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {!isMember ? (
                  <button className="toggle-btn" aria-label={`Toggle visibility: currently ${form.isPublic ? "public" : "private"}`} aria-pressed={form.isPublic} style={{ background: form.isPublic ? "#4ade80" : "#ddd", border: "2px solid var(--border-color)" }} onClick={() => setForm({ ...form, isPublic: !form.isPublic })}>
                    {form.isPublic ? "PUBLIC" : "PRIVATE"}
                  </button>
                ) : (
                  <span className="toggle-btn" style={{ background: "#4ade80", border: "2px solid var(--border-color)", cursor: "default", opacity: 0.7, display: "flex", alignItems: "center", justifyContent: "center" }}>PUBLIC</span>
                )}
              </div>
              <textarea className="textarea-field" placeholder="Paste your code here..." value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              {/* File attachments */}
              <div style={{ borderTop: "1.5px solid var(--divider)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
                    </svg>
                    ATTACHED FILES
                    {createPendingFiles.length > 0 && (
                      <span style={{ background: "var(--text)", color: "var(--surface)", borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>{createPendingFiles.length}</span>
                    )}
                  </span>
                  <button className="btn btn-teal" aria-label="Upload file" style={{ fontSize: 10, padding: "5px 12px", gap: 5 }} onClick={() => createFileInputRef.current?.click()}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    UPLOAD FILE
                  </button>
                  <input ref={createFileInputRef} type="file" style={{ display: "none" }} onChange={handleCreateFileAdd} />
                </div>
                {createFileError && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 11 }}>{createFileError}</div>}
                {createPendingFiles.length === 0 ? (
                  <div style={{ border: "1.5px dashed var(--border-color)", borderRadius: 8, padding: "20px 16px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }} onClick={() => createFileInputRef.current?.click()}>
                    Click to attach a file<br/><span style={{ fontSize: 10, opacity: 0.6 }}>Max. 4 MB per file</span>
                  </div>
                ) : (
                  <div style={{ border: "1.5px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
                    {createPendingFiles.map(({ file, id }, i) => (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: i < createPendingFiles.length - 1 ? "1px solid var(--divider)" : "none", background: "var(--surface)" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 6, border: "1.5px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--text-muted)" }}>
                          {fileMimeLabel(file.type || "application/octet-stream")}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{file.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{formatBytes(file.size)}</div>
                        </div>
                        <button onClick={() => handleCreateFileRemove(id)} aria-label="Remove file" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1.5px solid var(--border-color)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLElement).style.color = "var(--red)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ flexDirection: "column", gap: 8, alignItems: "stretch" }}>
              {createUploadProgress && (
                <div style={{ paddingBottom: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>
                    <span>Uploading file {createUploadProgress.current} of {createUploadProgress.total}...</span>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{createUploadProgress.pct}%</span>
                  </div>
                  <div style={{ height: 5, background: "var(--surface2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <div style={{ height: "100%", width: `${createUploadProgress.pct}%`, background: "var(--teal)", borderRadius: 4, transition: "width 0.15s ease" }} />
                  </div>
                </div>
              )}
              {createUploadError && <div className="alert alert-error" style={{ fontSize: 11, padding: "6px 10px" }}>{createUploadError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-white" onClick={() => { setShowCreateModal(false); setCreatePendingFiles([]); setCreateFileError(""); setCreateUploadError(""); }} disabled={formLoading}>CANCEL</button>
                <button className="btn btn-teal" onClick={handleCreateSnippet} disabled={formLoading} aria-label="Save new snippet" title="Ctrl+S" style={{ flex: 1 }}>
                  {createUploadProgress ? `UPLOADING ${createUploadProgress.current}/${createUploadProgress.total}... ${createUploadProgress.pct}%` : formLoading ? "SAVING..." : "SAVE CODE"}
                  {!formLoading && <span style={{ fontSize: 9, opacity: .5, marginLeft: 4 }}>Ctrl+S</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">EDIT SNIPPET</span></div>
            <div className="modal-body">
              {formError   && <div className="alert alert-error">{formError}</div>}
              {formSuccess && <div className="alert alert-success">{formSuccess}</div>}
              <input type="text" className="input-field" placeholder="Snippet Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="form-row">
                <select className="select-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {!isMember ? (
                  <button className="toggle-btn" aria-label={`Toggle visibility: currently ${form.isPublic ? "public" : "private"}`} aria-pressed={form.isPublic} style={{ background: form.isPublic ? "#4ade80" : "#ddd", border: "2px solid var(--border-color)" }} onClick={() => setForm({ ...form, isPublic: !form.isPublic })}>
                    {form.isPublic ? "PUBLIC" : "PRIVATE"}
                  </button>
                ) : (
                  <span className="toggle-btn" style={{ background: "#4ade80", border: "2px solid var(--border-color)", cursor: "default", opacity: 0.7, display: "flex", alignItems: "center", justifyContent: "center" }}>PUBLIC</span>
                )}
              </div>
              <textarea className="textarea-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              {/* File attachments */}
              <div style={{ borderTop: "1.5px solid var(--divider)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: fileUploading ? 8 : 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
                    </svg>
                    ATTACHED FILES
                    {editFiles.length > 0 && <span style={{ background: "var(--text)", color: "var(--surface)", borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>{editFiles.length}</span>}
                  </span>
                  <button className="btn btn-teal" aria-label="Upload file" style={{ fontSize: 10, padding: "5px 12px", gap: 5, minWidth: 110 }} onClick={() => !fileUploading && fileInputRef.current?.click()} disabled={fileUploading}>
                    {fileUploading ? `${uploadProgress}%` : (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>UPLOAD FILE</>
                    )}
                  </button>
                  <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
                </div>
                {fileUploading && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ height: 4, background: "var(--surface2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                      <div style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--teal)", borderRadius: 4, transition: "width 0.2s ease" }} />
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Uploading... {uploadProgress}%</div>
                  </div>
                )}
                {fileError && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 11 }}>{fileError}</div>}
                {editFiles.length === 0 ? (
                  <div style={{ border: "1.5px dashed var(--border-color)", borderRadius: 8, padding: "20px 16px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
                    Click to attach a file<br/><span style={{ fontSize: 10, opacity: 0.6 }}>Max. 4 MB per file</span>
                  </div>
                ) : (
                  <div style={{ border: "1.5px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
                    {editFiles.map((f, i) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: i < editFiles.length - 1 ? "1px solid var(--divider)" : "none", background: "var(--surface)" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 6, border: "1.5px solid var(--border-color)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)" }}>
                          {f.mimeType.startsWith("image/") ? (
                            <img src={`/api/files/${f.id}`} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--text-muted)" }}>{fileMimeLabel(f.mimeType)}</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{f.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{formatBytes(f.size)}</div>
                        </div>
                        <button onClick={() => handleFileDelete(f.id)} aria-label={`Delete file ${f.name}`} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1.5px solid var(--border-color)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLElement).style.color = "var(--red)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-white" onClick={() => setShowEditModal(false)}>CANCEL</button>
              <button className="btn btn-teal" onClick={handleEditSnippet} disabled={formLoading} aria-label="Save changes" title="Ctrl+S">
                {formLoading ? "SAVING..." : "SAVE CHANGES"}{!formLoading && <span style={{ fontSize: 9, opacity: .5, marginLeft: 4 }}>Ctrl+S</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTER MODAL ── */}
      {showRegisterModal && isSuperAdmin && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-body" style={{ paddingTop: 28, paddingBottom: 28 }}>
              <h2 className="modal-title" style={{ fontSize: 15, marginBottom: 4 }}>REGISTER NEW ACCOUNT</h2>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>Account will be registered as MEMBER.</p>
              {regError   && <div className="alert alert-error">{regError}</div>}
              {regSuccess && <div className="alert alert-success">{regSuccess}</div>}
              <input type="text" className="input-field" placeholder="Username" aria-label="Username" value={regForm.username} onChange={(e) => setRegForm({ ...regForm, username: e.target.value })} />
              <input type="password" className="input-field" placeholder="Password" aria-label="Password" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleRegister()} />
              <button className="btn btn-yellow" onClick={handleRegister} disabled={regLoading} aria-label="Register account" style={{ width: "100%", padding: "14px", fontSize: "12px", letterSpacing: "0.08em", marginTop: 4 }}>
                {regLoading ? "CREATING..." : "CREATE ACCOUNT"}
              </button>
              <button className="close-link" onClick={() => setShowRegisterModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RUN MODAL ── */}
      {showRunModal && runSnippet && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="modal-header">
              <span className="modal-title">RUN — {runSnippet.filename}</span>
            </div>
            <div className="modal-body">
              <div ref={outputRef} className="run-output" style={{ color: runHasError ? "#ff6b6b" : "#4ade80", position: "relative", overflowY: "auto" }}>
                {runOutput || (running ? "" : "// No output")}
                {running && <span style={{ display: "inline-block", width: 8, height: 14, background: "#4ade80", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />}
                {runImages.map((img, i) => (
                  <div key={i} style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4, letterSpacing: "0.05em" }}>📎 {img.name}</div>
                    <img src={`data:${img.mime};base64,${img.data}`} alt={img.name} width={600} height={400} style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 8, border: "1.5px solid var(--border-color)", display: "block", width: "auto", height: "auto" }} />
                  </div>
                ))}
              </div>
              {running && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Running on server...
                </div>
              )}
              {!running && runElapsed > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Executed in {runElapsed}ms
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-white" onClick={() => { navigator.clipboard.writeText(runOutput); setCopiedOutput(true); setTimeout(() => setCopiedOutput(false), 2000); }} disabled={running}>
                {copiedOutput ? "Copied!" : "Copy Output"}
              </button>
              <button className="btn btn-black" onClick={() => { if (runAbortRef.current) { runAbortRef.current.abort(); runAbortRef.current = null; } setShowRunModal(false); setRunning(false); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DIALOG ── */}
      {confirmDialog.open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)", animation: "fadeIn 0.12s ease" }} onClick={closeConfirm}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "2px solid var(--border-color)", borderRadius: 12, boxShadow: "4px 4px 0 var(--border-color)", padding: "28px 28px 22px", maxWidth: 380, width: "calc(100vw - 40px)", animation: "slideUp 0.15s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em" }}>{confirmDialog.title}</span>
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 22px 0" }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={closeConfirm} aria-label="Cancel" style={{ flex: 1, padding: "10px 0", background: "var(--surface2)", border: "1.5px solid var(--border-color)", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text)", letterSpacing: "0.05em" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--text)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"}>
                CANCEL
              </button>
              <button onClick={confirmDialog.onConfirm} aria-label={confirmDialog.confirmLabel || "Confirm"} style={{ flex: 1, padding: "10px 0", background: "#ef4444", border: "1.5px solid #dc2626", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#dc2626"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#ef4444"}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Scroll to top" aria-label="Scroll to top"
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 9000,
            width: 44, height: 44, borderRadius: "50%",
            background: "var(--teal)", border: "2.5px solid var(--border-color)",
            boxShadow: "3px 3px 0 var(--border-color)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all .15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 var(--border-color)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 var(--border-color)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      )}

      <style suppressHydrationWarning>{`
        @keyframes blink  { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </>
  );
}