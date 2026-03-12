"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageLoader from "@/components/PageLoader";
import Navbar from "@/components/Navbar";

interface GlobalFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

interface Snippet {
  id: string;
  title: string;
  filename: string;
  code: string;
  category: string;
  isPublic: boolean;
  views: number;
  updatedAt: string;
  admin: { username: string };
  createdAt: string;
  attachments: GlobalFile[];
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: { username: string; role: string };
}

interface NavUser {
  id: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
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

function highlight(code: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const TOKEN_PATTERNS: Array<{ re: RegExp; color: string; italic?: boolean }> = [
    { re: /\/\/.*$/gm,                   color: "#6a9955", italic: true },
    { re: /`(?:[^`\\]|\\.)*`/g,          color: "#ce9178" },
    { re: /"(?:[^"\\]|\\.)*"/g,          color: "#ce9178" },
    { re: /'(?:[^'\\]|\\.)*'/g,          color: "#ce9178" },
    { re: /\b(?:const|let|var|function|async|await|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|try|catch|finally|throw|import|export|default|class|extends|super|this|true|false|null|undefined|void|of|in)\b/g, color: "#569cd6" },
    { re: /\b\d+(?:\.\d+)?\b/g,          color: "#b5cea8" },
    { re: /\b(?:console|process|require|module|exports|Promise|setTimeout|setInterval|clearTimeout|clearInterval|fetch|URL|Buffer|Error|Object|Array|String|Number|Boolean|JSON|Math|Date|Map|Set|RegExp)\b/g, color: "#4ec9b0" },
    { re: /\b([a-zA-Z_$][\w$]*)(?=\s*\()/g, color: "#dcdcaa" },
    { re: /(?<=\.)([a-zA-Z_$][\w$]*)/g,  color: "#9cdcfe" },
  ];

  return code
    .split("\n")
    .map(rawLine => {
      const line = escapeHtml(rawLine);
      type Span = { start: number; end: number; color: string; italic?: boolean };
      const spans: Span[] = [];
      for (const { re, color, italic } of TOKEN_PATTERNS) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
          spans.push({ start: m.index, end: m.index + m[0].length, color, italic });
          if (m[0].length === 0) re.lastIndex++;
        }
      }
      spans.sort((a, b) => a.start - b.start || b.end - a.end);
      let result = "";
      let cursor = 0;
      for (const span of spans) {
        if (span.start < cursor) continue;
        result += line.slice(cursor, span.start);
        const style = `color:${span.color}${span.italic ? ";font-style:italic" : ""}`;
        result += `<span style="${style}">${line.slice(span.start, span.end)}</span>`;
        cursor = span.end;
      }
      result += line.slice(cursor);
      return result;
    })
    .join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "img";
  if (mimeType.startsWith("video/")) return "vid";
  if (mimeType.startsWith("audio/")) return "aud";
  if (mimeType.startsWith("text/")) return "txt";
  if (mimeType.includes("json")) return "json";
  if (mimeType.includes("pdf")) return "pdf";
  return "file";
}

const FETCH_TIMEOUT_MS = 10_000;

const roleColor = (role: string) =>
  role === "SUPERADMIN" ? "#f5c542" : role === "ADMIN" ? "#4ecdc4" : "#aaaaaa";

export default function SnippetClient({ id, initialData }: { id: string; initialData?: Snippet | null }) {
  const router = useRouter();

  const [snippet, setSnippet]             = useState<Snippet | null>(null);
  const [loading, setLoading]             = useState(true);

  const [copied, setCopied]               = useState(false);
  const [attachments, setAttachments]     = useState<GlobalFile[]>([]);

  // Like state
  const [likeCount, setLikeCount]         = useState(0);
  const [liked, setLiked]                 = useState(false);
  const [likeLoading, setLikeLoading]     = useState(false);

  // Comment state
  const [comments, setComments]           = useState<Comment[]>([]);
  const [commentBody, setCommentBody]     = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError]   = useState("");
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Auth
  const [user, setUser]                   = useState<NavUser | null>(null);
  const [userChecked, setUserChecked]     = useState(false);

  const [showRunModal, setShowRunModal]   = useState(false);
  const [runOutput, setRunOutput]         = useState("");
  const [runImages, setRunImages]         = useState<{ name: string; mime: string; data: string }[]>([]);
  const [runHasError, setRunHasError]     = useState(false);
  const [runElapsed, setRunElapsed]       = useState(0);
  const [running, setRunning]             = useState(false);
  const [copiedOutput, setCopiedOutput]   = useState(false);
  const [copiedLink, setCopiedLink]       = useState(false);
  const [previewFile, setPreviewFile]     = useState<GlobalFile | null>(null);
  const runAbortRef                       = useRef<AbortController | null>(null);

  const lastUpdatedAt    = useRef<string | null>(null);
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTracked       = useRef(false);
  const loadingTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLikeUntil    = useRef<number>(0);
  const suppressCommentUntil = useRef<number>(0);
  const outputRef            = useRef<HTMLDivElement | null>(null);
  const userScrolledUp   = useRef(false);
  const prevOutputLen    = useRef(0);

  // Fetch current user
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        setUser(d.authenticated ? { ...d.user } : null);
        setUserChecked(true);
      })
      .catch(() => { setUser(null); setUserChecked(true); });
  }, []);

  useEffect(() => {
    if (showRunModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [showRunModal]);

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
    if (delta > 0 && delta < 300) el.scrollTop = el.scrollHeight;
  }, [runOutput]);

  const fetchSnippet = useCallback(async (silent = false) => {
    if (!id) return;
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(`/api/snippets/${id}`, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeoutId);
      if (!r.ok) { if (!silent) setLoading(false); return; }
      const data: Snippet = await r.json();
      if (silent) {
        if (!lastUpdatedAt.current || data.updatedAt !== lastUpdatedAt.current) {
          setSnippet(data);
          lastUpdatedAt.current = data.updatedAt;
        } else {
          setSnippet(prev => prev ? { ...prev, views: data.views } : prev);
        }
      } else {
        setSnippet(data);
        lastUpdatedAt.current = data.updatedAt;
        setLoading(false);
      }
    } catch {
      clearTimeout(timeoutId);
      if (!silent) setLoading(false);
    }
  }, [id]);

  const fetchAttachments = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/snippets/${id}/files`, { cache: "no-store" });
      if (!r.ok) return;
      const data: GlobalFile[] = await r.json();
      setAttachments(data);
    } catch { /* silent */ }
  }, [id]);

  const fetchLikes = useCallback(async (fromPoll = false) => {
    if (!id) return;
    if (fromPoll && Date.now() < suppressLikeUntil.current) return;
    try {
      const r = await fetch(`/api/snippets/${id}/like`, { cache: "no-store", credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      setLikeCount(data.count ?? 0);
      setLiked(data.liked ?? false);
    } catch { /* silent */ }
  }, [id]);

  const fetchComments = useCallback(async (fromPoll = false) => {
    if (!id) return;
    if (fromPoll && Date.now() < suppressCommentUntil.current) return;
    try {
      const r = await fetch(`/api/snippets/${id}/comments`, { cache: "no-store", credentials: "include" });
      if (!r.ok) return;
      const data: Comment[] = await r.json();
      setComments(data);
    } catch { /* silent */ }
    finally { setCommentsLoading(false); }
  }, [id]);

  // Bundle fetch: 1 request = snippet + likes + comments + files
  // withAuth: true = kirim credentials (after userChecked), false = skip liked check
  const fetchBundle = useCallback(async (withAuth = false) => {
    if (!id) return;
    try {
      const r = await fetch(`/api/snippets/${id}/bundle`, {
        cache: "no-store",
        credentials: withAuth ? "include" : "omit",
      });
      if (!r.ok) { setLoading(false); setCommentsLoading(false); return; }
      const data = await r.json();
      setSnippet(data.snippet);
      lastUpdatedAt.current = data.snippet?.updatedAt ?? null;
      setAttachments(data.files ?? []);
      setLikeCount(data.likeCount ?? 0);
      if (withAuth) setLiked(data.liked ?? false);
      setComments(data.comments ?? []);
      setCommentsLoading(false);
      setLoading(false);
    } catch {
      setLoading(false);
      setCommentsLoading(false);
    }
  }, [id]);

  // After auth confirmed, re-fetch bundle WITH credentials to get correct liked status
  useEffect(() => {
    if (userChecked && id) fetchBundle(true);
  }, [userChecked, fetchBundle, id]);

  useEffect(() => {
    if (!id || hasTracked.current) return;
    hasTracked.current = true;

    fetchBundle(false); // immediate load without auth (fast)

    let shouldTrackView = false;
    try {
      const VISITOR_KEY = "cs_visitor_id";
      const VIEWS_KEY   = "cs_viewed";
      let visitorId = localStorage.getItem(VISITOR_KEY);
      if (!visitorId) {
        visitorId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(VISITOR_KEY, visitorId);
      }
      const viewed  = new Set((localStorage.getItem(VIEWS_KEY) || "").split(",").filter(Boolean));
      const viewKey = `${visitorId}:${id}`;
      if (!viewed.has(viewKey)) {
        viewed.add(viewKey);
        localStorage.setItem(VIEWS_KEY, Array.from(viewed).join(","));
        shouldTrackView = true;
      }
    } catch {
      shouldTrackView = true;
    }

    if (shouldTrackView) {
      fetch(`/api/snippets/${id}`, { method: "PATCH" })
        .then(r => r.json())
        .then(data => {
          if (data.views !== undefined) setSnippet(prev => prev ? { ...prev, views: data.views } : prev);
        })
        .catch(() => {});
    }

    // Only poll snippet for view/code changes — likes optimistic, comments via bundle
    pollRef.current = setInterval(() => {
      fetchSnippet(true);
    }, 10000);
    loadingTimerRef.current = setTimeout(() => setLoading(false), FETCH_TIMEOUT_MS + 1000);
    return () => {
      if (pollRef.current)       clearInterval(pollRef.current);
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [fetchBundle, fetchSnippet, id]);

  const handleLike = async () => {
    if (!user) { router.push("/login"); return; }
    if (likeLoading || !snippet) return;

    // Optimistic update immediately
    const wasLiked = liked;
    const prevCount = likeCount;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    suppressLikeUntil.current = Date.now() + 5000;

    setLikeLoading(true);
    try {
      const r = await fetch(`/api/snippets/${snippet.id}/like`, { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        setLiked(data.liked);
        setLikeCount(data.count);
        suppressLikeUntil.current = Date.now() + 5000;
      } else {
        // Rollback on error
        setLiked(wasLiked);
        setLikeCount(prevCount);
        suppressLikeUntil.current = 0;
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount(prevCount);
      suppressLikeUntil.current = 0;
    }
    finally { setLikeLoading(false); }
  };

  const handlePostComment = async () => {
    if (!user) { router.push("/login"); return; }
    if (!commentBody.trim() || commentLoading || !snippet) return;

    // Optimistic: append immediately with temp id
    const tempComment: Comment = {
      id:        `temp-${Date.now()}`,
      body:      commentBody.trim(),
      createdAt: new Date().toISOString(),
      user:      { username: user.username, role: user.role },
    };
    const body = commentBody.trim();
    setComments(prev => [...prev, tempComment]);
    setCommentBody("");
    suppressCommentUntil.current = Date.now() + 8000;

    setCommentLoading(true);
    setCommentError("");
    try {
      const r = await fetch(`/api/snippets/${snippet.id}/comments`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body }),
      });
      const data = await r.json();
      if (!r.ok) {
        // Rollback temp comment
        setComments(prev => prev.filter(c => c.id !== tempComment.id));
        setCommentBody(body);
        setCommentError(data.error || "Failed to post comment");
        suppressCommentUntil.current = 0;
        return;
      }
      // Replace temp with real comment from server
      setComments(prev => prev.map(c => c.id === tempComment.id ? data : c));
      suppressCommentUntil.current = Date.now() + 5000;
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
      setCommentBody(body);
      setCommentError("Something went wrong");
      suppressCommentUntil.current = 0;
    }
    finally { setCommentLoading(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      const r = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
      if (r.ok) setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* silent */ }
  };

  const handleCopy = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!snippet) return;
    const blob = new Blob([snippet.code], { type: "text/javascript" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = snippet.filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleRun = async () => {
    if (!snippet) return;
    setRunOutput(""); setRunImages([]); setRunHasError(false); setRunElapsed(0);
    setShowRunModal(true); setRunning(true);
    const abortCtrl = new AbortController();
    runAbortRef.current = abortCtrl;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: snippet.code, snippetId: snippet.id }),
        signal: abortCtrl.signal,
      });
      if (!res.body) throw new Error("No response body");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const ev = JSON.parse(jsonStr);
            if (ev.type === "done") {
              setRunElapsed(ev.elapsed || 0);
              setRunHasError(ev.hasError || false);
              setRunning(false);
            } else if (ev.type === "image") {
              setRunImages(prev => [...prev, { name: ev.name, mime: ev.mime, data: ev.data }]);
            } else {
              setRunOutput(prev => prev ? prev + "\n" + ev.text : ev.text);
              if (ev.type === "error") setRunHasError(true);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setRunOutput(`Failed to run: ${err instanceof Error ? err.message : String(err)}`);
        setRunHasError(true);
      }
      setRunning(false);
    } finally { runAbortRef.current = null; }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/code?v=${snippet?.filename}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRaw = () => window.open(`/raw?v=${snippet?.filename}`, "_blank");

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(runOutput);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  if (loading) return <PageLoader />;
  if (!snippet) return (<><Navbar /><main className="main"><div className="loading">SNIPPET NOT FOUND.</div></main></>);

  const highlightedLines = highlight(snippet.code).split("\n");
  const catStyle = getCategoryStyle(snippet.category);
  const canDeleteComment = (c: Comment) =>
    user && (user.username === c.user.username || user.role === "SUPERADMIN" || user.role === "ADMIN");

  return (
    <>
      <Navbar />
      <main className="main">

        <button className="btn-back" onClick={() => router.back()} style={{ marginBottom: 20 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          BACK
        </button>

        <div className="snippet-detail-header">
          <div>
            {/* Colored category badge */}
            <span style={{
              display: "inline-block",
              padding: "3px 12px", borderRadius: 4,
              background: catStyle.bg, color: catStyle.text,
              fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em", border: "1.5px solid var(--border-color)",
              marginBottom: 8,
            }}>
              {snippet.category.toUpperCase()}
            </span>
            <h1 className="snippet-detail-title">{snippet.title}</h1>
            <div className="snippet-detail-meta">
              <span className="snippet-views">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                {snippet.views} Views
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {formatDate(snippet.createdAt)}
              </span>
              {snippet.updatedAt !== snippet.createdAt && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-faint)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Updated {formatDate(snippet.updatedAt)}
                </span>
              )}
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                {snippet.admin.username}
              </span>
            </div>
          </div>
          <div className="snippet-detail-actions">
            <button className="btn btn-white btn-icon" onClick={handleRaw} title="View Raw">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </button>
            <button className="btn btn-white btn-icon" onClick={handleCopyLink} title="Copy Link">
              {copiedLink ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )}
            </button>
            <button className="btn btn-teal btn-icon" onClick={handleDownload} title="Download">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button className="btn btn-yellow" onClick={handleRun} style={{ gap: 8, paddingLeft: 20, paddingRight: 20, fontSize: 14 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              RUN
            </button>
          </div>
        </div>

        {/* Code block */}
        <div style={{ borderRadius: 10, overflow: "hidden", border: "2.5px solid var(--border-color)", boxShadow: "6px 6px 0 var(--border-color)", fontFamily: "'Fira Code','Cascadia Code','JetBrains Mono','Consolas','Courier New',monospace" }}>
          <div style={{ background: "#323233", display: "flex", alignItems: "center", padding: "0 12px", height: 38, gap: 8, borderBottom: "1px solid #111" }}>
            {["#ff5f57","#febc2e","#28c840"].map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,.25)" }} />
            ))}
            <div style={{ marginLeft: 12, background: "#1e1e1e", color: "#ccc", fontSize: 12, padding: "4px 16px", borderRadius: "4px 4px 0 0", borderTop: "1px solid #007acc", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#f5d020"><path d="M3 3h18v18H3V3zm16.5 13.5V7.5l-9 4.5 9 4.5z"/></svg>
              {snippet.filename}
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={handleCopy} style={{ background: "none", border: "1px solid #555", borderRadius: 4, color: copied ? "#4ade80" : "#aaa", fontSize: 11, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", transition: "color .2s, border-color .2s" }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div style={{ background: "#1e1e1e", display: "flex", overflow: "auto", maxHeight: "65vh" }}>
            <div style={{ background: "#1e1e1e", color: "#5a5a5a", fontSize: 13, lineHeight: "1.7", padding: "16px 0", minWidth: 52, textAlign: "right", userSelect: "none", borderRight: "1px solid #2d2d2d", flexShrink: 0 }}>
              {highlightedLines.map((_, i) => (
                <div key={i} style={{ padding: "0 12px 0 8px" }}>{i + 1}</div>
              ))}
            </div>
            <div style={{ flex: 1, padding: "16px 24px", minWidth: 0 }}>
              <pre style={{ margin: 0, fontSize: 13, lineHeight: "1.7", color: "#d4d4d4", whiteSpace: "pre", fontFamily: "inherit" }}>
                {highlightedLines.map((line, i) => (
                  <div key={i} style={{ minHeight: "1.7em" }} dangerouslySetInnerHTML={{ __html: line || " " }} />
                ))}
              </pre>
            </div>
          </div>
          <div style={{ background: "#007acc", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", height: 22, gap: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span>main</span>
              <span>JavaScript</span>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span>{snippet.code.split("\n").length} lines</span>
              <span>UTF-8</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite" }} />
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              ATTACHED FILES
              <span style={{ background: "var(--text)", color: "var(--surface)", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                {attachments.length}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
              {attachments.map(f => (
                <div
                  key={f.id}
                  onClick={() => f.mimeType.startsWith("image/") && setPreviewFile(f)}
                  style={{ border: "1.5px solid var(--border-color)", borderRadius: 8, overflow: "hidden", background: "var(--surface2)", cursor: f.mimeType.startsWith("image/") ? "zoom-in" : "default", transition: "border-color 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--text)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; }}
                >
                  <div style={{ width: "100%", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--code-bg)", overflow: "hidden" }}>
                    {f.mimeType.startsWith("image/") ? (
                      <img src={`/api/files/${f.id}`} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 11, color: "#aaa", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{fileEmoji(f.mimeType).toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ padding: "6px 7px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{f.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{formatBytes(f.size)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LIKE + COMMENTS SECTION ── */}
        <div style={{ marginTop: 40, borderTop: "2px solid var(--border-color)", paddingTop: 32 }}>

          {/* Like button row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <button
              onClick={!likeLoading ? handleLike : undefined}
              title={user ? (liked ? "Unlike" : "Like this snippet") : "Sign in to like"}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10,
                border: `2.5px solid ${liked ? "var(--red)" : "var(--border-color)"}`,
                background: liked ? "rgba(242,92,84,0.1)" : "var(--surface)",
                color: liked ? "var(--red)" : "var(--text-muted)",
                cursor: "pointer",
                opacity: likeLoading ? 0.7 : 1,
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                boxShadow: liked ? "3px 3px 0 var(--red)" : "3px 3px 0 var(--border-color)",
                transition: "all .15s", letterSpacing: "0.04em",
              }}
              onMouseOver={e => { if (!liked) { (e.currentTarget as HTMLElement).style.borderColor = "var(--red)"; (e.currentTarget as HTMLElement).style.color = "var(--red)"; } }}
              onMouseOut={e  => { if (!liked) { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; } }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "var(--red)" : "none"} stroke={liked ? "var(--red)" : "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {liked ? "Liked" : "Like"}
              <span style={{
                background: liked ? "var(--red)" : "var(--surface2)",
                color: liked ? "#fff" : "var(--text-muted)",
                border: `1.5px solid ${liked ? "var(--red)" : "var(--border-color)"}`,
                borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 700, marginLeft: 2,
              }}>
                {likeCount}
              </span>
            </button>

            {!user && userChecked && (
              <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                <a href="/login" style={{ color: "var(--teal)", textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 700 }}>Sign in</a>
                {" "}to like or comment
              </span>
            )}
          </div>

          {/* Comments section */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              COMMENTS
              <span style={{ background: "var(--text)", color: "var(--surface)", borderRadius: 5, padding: "1px 8px", fontSize: 10 }}>
                {comments.length}
              </span>
            </div>

            {/* Post comment form */}
            {user ? (
              <div style={{ marginBottom: 24, background: "var(--surface)", border: "2.5px solid var(--border-color)", borderRadius: 12, padding: 16, boxShadow: "3px 3px 0 var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: roleColor(user.role), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#000", flexShrink: 0 }}>
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 700, color: roleColor(user.role) }}>{user.username}</span>
                </div>
                <textarea
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  placeholder="Write a comment..."
                  maxLength={2000}
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px",
                    fontFamily: "var(--font-mono)", fontSize: 12,
                    border: "2px solid var(--border-color)", borderRadius: 8,
                    background: "var(--surface2)", color: "var(--text)",
                    resize: "vertical", outline: "none", lineHeight: 1.6,
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePostComment(); }}
                />
                {commentError && (
                  <div style={{ fontSize: 11, color: "var(--red)", fontFamily: "var(--font-mono)", marginTop: 6 }}>{commentError}</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                    {commentBody.length}/2000 — Ctrl+Enter to submit
                  </span>
                  <button
                    onClick={handlePostComment}
                    disabled={commentLoading || !commentBody.trim()}
                    style={{
                      padding: "8px 18px", borderRadius: 8,
                      border: "2px solid var(--border-color)",
                      background: commentBody.trim() ? "var(--teal)" : "var(--surface2)",
                      color: commentBody.trim() ? "#000" : "var(--text-faint)",
                      cursor: commentBody.trim() ? "pointer" : "not-allowed",
                      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                      boxShadow: "2px 2px 0 var(--border-color)", letterSpacing: "0.04em",
                      transition: "all .1s",
                    }}
                  >
                    {commentLoading ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </div>
            ) : userChecked ? (
              <div style={{ marginBottom: 24, background: "var(--surface2)", border: "2px dashed var(--border-color)", borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                  You must be signed in to post a comment.
                </p>
                <a href="/login" className="btn btn-teal" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#000", background: "var(--teal)", border: "2px solid var(--border-color)", boxShadow: "2px 2px 0 var(--border-color)" }}>
                  Sign In
                </a>
              </div>
            ) : null}

            {/* Comments list */}
            {commentsLoading ? (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", padding: "20px 0" }}>Loading comments...</div>
            ) : comments.length === 0 ? (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", padding: "20px 0", textAlign: "center" }}>
                No comments yet. Be the first to comment.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {comments.map(c => (
                  <div key={c.id} style={{
                    background: "var(--surface)", border: "2px solid var(--border-color)",
                    borderRadius: 10, padding: "14px 16px",
                    boxShadow: "2px 2px 0 var(--border-color)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: roleColor(c.user.role), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#000", flexShrink: 0 }}>
                          {c.user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: roleColor(c.user.role) }}>
                          {c.user.username}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>
                          {formatDate(c.createdAt)} at {formatTime(c.createdAt)}
                        </span>
                      </div>
                      {canDeleteComment(c) && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 4, borderRadius: 4, display: "flex", alignItems: "center", transition: "color .1s" }}
                          title="Delete comment"
                          onMouseOver={e => (e.currentTarget.style.color = "var(--red)")}
                          onMouseOut={e  => (e.currentTarget.style.color = "var(--text-faint)")}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Image preview */}
        {previewFile && (
          <div
            onClick={() => setPreviewFile(null)}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", backdropFilter: "blur(4px)" }}
          >
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "min(520px, 90vw)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <img src={`/api/files/${previewFile.id}`} alt={previewFile.name} width={500} height={400} style={{ maxWidth: "min(500px, 80vw)", maxHeight: "55vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", width: "auto", height: "auto" }} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 10 }}>
                <span>{previewFile.name}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{formatBytes(previewFile.size)}</span>
                <button onClick={() => setPreviewFile(null)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 12px", cursor: "pointer", marginLeft: 4 }}>
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Run modal */}
      {showRunModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 660 }}>
            <div className="modal-header">
              <span className="modal-title">RUN OUTPUT — {snippet.filename}</span>
            </div>
            <div className="modal-body">
              <div ref={outputRef} className="run-output" style={{ color: runHasError ? "#ff6b6b" : "#4ade80", position: "relative", overflowY: "auto", maxHeight: "55vh" }}>
                {runOutput || (running ? "" : "// No output")}
                {running && (
                  <span style={{ display: "inline-block", width: 8, height: 14, background: "#4ade80", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                )}
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
              <button className="btn btn-white" onClick={handleCopyOutput} disabled={running} style={{ flex: "none" }}>
                {copiedOutput ? "Copied!" : "Copy Output"}
              </button>
              <button className="btn btn-black" onClick={() => { if (runAbortRef.current) { runAbortRef.current.abort(); runAbortRef.current = null; } setShowRunModal(false); setRunning(false); }} style={{ flex: "none" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style suppressHydrationWarning>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}