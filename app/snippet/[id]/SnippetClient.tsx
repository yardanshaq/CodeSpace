"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PageLoader from "@/components/PageLoader";

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

function highlight(code: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return code
    .split("\n")
    .map((rawLine) => {
      let line = escape(rawLine);
      line = line.replace(
        /(&quot;[^&]*?&quot;|&#x27;[^&#x27;]*?&#x27;|`[^`]*?`|"[^"]*?"|'[^']*?')/g,
        '<span style="color:#ce9178">$1</span>'
      );
      line = line.replace(
        /(\/\/.*$)/gm,
        '<span style="color:#6a9955;font-style:italic">$1</span>'
      );
      line = line.replace(
        /\b(const|let|var|function|async|await|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|try|catch|finally|throw|import|export|default|class|extends|super|this|true|false|null|undefined|void|of|in)\b/g,
        '<span style="color:#569cd6">$1</span>'
      );
      line = line.replace(
        /\b(\d+(\.\d+)?)\b/g,
        '<span style="color:#b5cea8">$1</span>'
      );
      line = line.replace(
        /\b(console|process|require|module|exports|Promise|setTimeout|setInterval|clearTimeout|clearInterval|fetch|URL|Buffer|Error|Object|Array|String|Number|Boolean|JSON|Math|Date|Map|Set|RegExp)\b/g,
        '<span style="color:#4ec9b0">$1</span>'
      );
      line = line.replace(
        /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g,
        '<span style="color:#dcdcaa">$1</span>'
      );
      line = line.replace(
        /\.([a-zA-Z_$][\w$]*)/g,
        '.<span style="color:#9cdcfe">$1</span>'
      );
      return line;
    })
    .join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.startsWith("text/")) return "📄";
  if (mimeType.includes("json")) return "📋";
  if (mimeType.includes("pdf")) return "📕";
  return "📦";
}

const FETCH_TIMEOUT_MS = 10_000;

export default function SnippetClient({ id, initialData }: { id: string; initialData?: Snippet | null }) {
  const router = useRouter();

  // initialData dari server — kalau ada, langsung render tanpa loading screen
  const [snippet, setSnippet] = useState<Snippet | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [copied, setCopied] = useState(false);

  const [showRunModal, setShowRunModal] = useState(false);
  const [runOutput, setRunOutput] = useState("");
  const [runHasError, setRunHasError] = useState(false);
  const [runElapsed, setRunElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const lastUpdatedAt = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTracked = useRef(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSnippet = useCallback(
    async (silent = false) => {
      if (!id) return;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        // cache: "no-store" supaya polling selalu dapat data terbaru, tidak kena browser cache
        const r = await fetch(`/api/snippets/${id}`, { signal: controller.signal, cache: "no-store" });
        clearTimeout(timeoutId);
        if (!r.ok) { if (!silent) setLoading(false); return; }
        const data: Snippet = await r.json();
        if (silent) {
          if (!lastUpdatedAt.current || data.updatedAt !== lastUpdatedAt.current) {
            // Ada perubahan konten snippet — update semua
            setSnippet(data);
            lastUpdatedAt.current = data.updatedAt;
          } else {
            // Konten tidak berubah tapi views bisa bertambah — update views saja
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
    },
    [id]
  );

  useEffect(() => {
    if (!id || hasTracked.current) return;
    hasTracked.current = true;

    // Kalau sudah ada initialData dari server, skip fetch pertama
    // Hanya track view dan mulai polling untuk update
    if (!initialData) fetchSnippet(false);

    // Tentukan apakah view perlu di-track SEBELUM fetch snippet
    // sehingga GET dan PATCH bisa jalan PARALLEL
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

    // Jalankan PATCH views — fetch snippet sudah dihandle di atas
    if (shouldTrackView) {
      fetch(`/api/snippets/${id}`, { method: "PATCH" })
        .then(r => r.json())
        .then(data => {
          // Update views di UI langsung setelah server confirm
          if (data.views !== undefined) {
            setSnippet(prev => prev ? { ...prev, views: data.views } : prev);
          }
        })
        .catch(() => {});
    }

    // Set lastUpdatedAt dari initialData supaya polling deteksi perubahan dengan benar
    if (initialData && !lastUpdatedAt.current) {
      lastUpdatedAt.current = initialData.updatedAt;
    }
    pollRef.current = setInterval(() => fetchSnippet(true), 3000);
    loadingTimerRef.current = setTimeout(() => setLoading(false), FETCH_TIMEOUT_MS + 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [fetchSnippet, id]);

  const handleCopy = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!snippet) return;
    const blob = new Blob([snippet.code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = snippet.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRun = async () => {
    if (!snippet) return;
    setRunOutput("");
    setRunHasError(false);
    setRunElapsed(0);
    setShowRunModal(true);
    setRunning(true);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: snippet.code, snippetId: snippet.id }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
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
            } else {
              setRunOutput(prev => prev ? prev + "\n" + ev.text : ev.text);
              if (ev.type === "error") setRunHasError(true);
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (err: unknown) {
      setRunOutput(`Failed to run: ${err instanceof Error ? err.message : String(err)}`);
      setRunHasError(true);
      setRunning(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/code?v=${snippet?.filename}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRaw = () => {
    window.open(`/raw?v=${snippet?.filename}`, "_blank");
  };

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(runOutput);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (loading) return <PageLoader />;
  if (!snippet) return (<><Navbar /><main className="main"><div className="loading">SNIPPET NOT FOUND.</div></main></>);

  const highlightedLines = highlight(snippet.code).split("\n");

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
            <span className="snippet-category-badge">{snippet.category.toUpperCase()}</span>
            <h1 className="snippet-detail-title">{snippet.title}</h1>
            <div className="snippet-detail-meta">
              <span className="snippet-views">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                {snippet.views} Views
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {formatDate(snippet.createdAt)}
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
              {copied ? "✓ Copied" : "⧉ Copy"}
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
              <span>⎇ main</span>
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

        {snippet.attachments.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              Source Files
              <span style={{ background: "var(--text)", color: "var(--surface)", borderRadius: 4, padding: "1px 7px", fontSize: 10 }}>
                {snippet.attachments.length}
              </span>
            </div>
            <div style={{ border: "2.5px solid var(--border-color)", borderRadius: 10, overflow: "hidden", boxShadow: "4px 4px 0 var(--border-color)", background: "var(--surface)" }}>
              {snippet.attachments.map((f, i) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < snippet.attachments.length - 1 ? `1.5px solid var(--divider)` : "none" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 6, border: "2px solid var(--border-color)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", fontSize: 20 }}>
                    {f.mimeType.startsWith("image/") ? (
                      <img src={`/api/admin/files/${f.id}`} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : fileEmoji(f.mimeType)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {f.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {f.mimeType} · {formatBytes(f.size)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showRunModal && (
        <div className="modal-overlay" onClick={() => setShowRunModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="modal-title">▶ RUN OUTPUT — {snippet.filename}</span>
              <button onClick={() => setShowRunModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text)" }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="run-output" style={{ color: runHasError ? "#ff6b6b" : "#4ade80", position: "relative" }}>
                {runOutput || (running ? "" : "// No output")}
                {running && (
                  <span style={{ display: "inline-block", width: 8, height: 14, background: "#4ade80", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                )}
              </div>
              {running && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>⟳ Running on server...</div>
              )}
              {!running && runElapsed > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>✓ Executed in {runElapsed}ms</div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-white" onClick={handleCopyOutput} disabled={running} style={{ flex: "none" }}>
                {copiedOutput ? "✓ Copied!" : "⧉ Copy Output"}
              </button>
              <button className="btn btn-black" onClick={() => setShowRunModal(false)} style={{ flex: "none" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </>
  );
}