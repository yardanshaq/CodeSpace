"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";

const PageLoader = dynamic(() => import("@/components/PageLoader"), { ssr: false });

interface Hardware {
  cpu: string; cpuCores: number;
  totalMem: number; usedMem: number;
  heapUsed: number; heapTotal: number;
  rss: number; loadAvg1: number; loadAvg5: number;
  region: string; nodeVersion: string; platform: string;
}
interface ServerStats {
  snippets: number; users: number; views: number;
  likes: number; comments: number; dbLatency: number;
  uptime: number; hardware: Hardware;
  recentSnippets: { id: string; title: string; category: string; createdAt: string; views: number; filename: string }[];
  timestamp: string;
}
interface DataPoint { time: string; latency: number; }

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  AI: { bg: "#f5c542", text: "#000" }, Anime: { bg: "#f472b6", text: "#000" },
  Converter: { bg: "#60a5fa", text: "#000" }, Downloader: { bg: "#f25c54", text: "#fff" },
  Generator: { bg: "#a78bfa", text: "#000" }, Other: { bg: "#94a3b8", text: "#000" },
  Random: { bg: "#fb923c", text: "#000" }, Scrape: { bg: "#4ecdc4", text: "#000" },
  Search: { bg: "#818cf8", text: "#fff" }, Tools: { bg: "#4ade80", text: "#000" },
  Translate: { bg: "#34d399", text: "#000" }, Uploader: { bg: "#f97316", text: "#fff" },
};

const fmtBytes = (b: number) => b >= 1073741824 ? (b/1073741824).toFixed(2)+" GB" : b >= 1048576 ? (b/1048576).toFixed(0)+" MB" : (b/1024).toFixed(0)+" KB";
const fmtNum   = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? (n/1e3).toFixed(1)+"K" : n.toString();
const fmtUp    = (s: number) => { const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60); return d>0?`${d}d ${h}h ${m}m`:h>0?`${h}h ${m}m`:`${m}m ${Math.floor(s%60)}s`; };
const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

function LatencyGraph({ data }: { data: DataPoint[] }) {
  const W = 500, H = 120;
  const GRID_COLS = 10, GRID_ROWS = 5;

  // Grid lines
  const gridLines = [];
  for (let i = 0; i <= GRID_ROWS; i++) {
    const y = (i / GRID_ROWS) * H;
    gridLines.push(<line key={`h${i}`} x1="0" y1={y} x2={W} y2={y} stroke="var(--grid-line)" strokeWidth="0.5"/>);
  }
  for (let i = 0; i <= GRID_COLS; i++) {
    const x = (i / GRID_COLS) * W;
    gridLines.push(<line key={`v${i}`} x1={x} y1="0" x2={x} y2={H} stroke="var(--grid-line)" strokeWidth="0.5"/>);
  }

  if (data.length < 1) return (
    <div style={{ position:"relative", background:"var(--graph-bg)", borderRadius:4, overflow:"hidden" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:120, display:"block" }} preserveAspectRatio="none">
        {gridLines}
        <text x={W/2} y={H/2} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily:"var(--font-mono)", fontSize:14, fill:"var(--text-faint)" }}>
          Waiting for data...
        </text>
      </svg>
    </div>
  );

  const vals = data.map(d => d.latency);
  const min = Math.max(0, Math.min(...vals) - 10);
  const max = Math.max(...vals) + 10;
  const range = max - min || 1;
  const toY = (v: number) => H - ((v - min) / range) * H;
  const toX = (i: number) => data.length < 2 ? W / 2 : (i / (data.length - 1)) * W;

  const pts = data.map((d, i) => `${toX(i)},${toY(d.latency)}`);
  const last = vals[vals.length - 1];
  const color = last < 100 ? "#4ecdc4" : last < 300 ? "#f5c542" : "#f25c54";
  const lastX = toX(data.length - 1);
  const lastY = toY(last);

  // Y-axis labels
  const yLabels = [];
  for (let i = 0; i <= GRID_ROWS; i++) {
    const v = Math.round(min + (1 - i / GRID_ROWS) * range);
    yLabels.push(
      <div key={i} style={{ position:"absolute", right:0, top:`${(i/GRID_ROWS)*100}%`, transform:"translateY(-50%)", fontFamily:"var(--font-mono)", fontSize:8, color:"var(--text-faint)", pointerEvents:"none", paddingRight:4 }}>
        {v}ms
      </div>
    );
  }

  const polyPts = data.length < 2
    ? `0,${toY(last)} ${W},${toY(last)}`
    : pts.join(" ");

  return (
    <div style={{ position:"relative" }}>
      <div style={{ position:"relative", background:"var(--graph-bg)", borderRadius:4, overflow:"hidden" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:120, display:"block", overflow:"visible" }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="glg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {gridLines}
          <polygon points={`0,${H} ${polyPts} ${W},${H}`} fill="url(#glg)"/>
          <polyline points={polyPts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx={lastX} cy={lastY} r="3" fill={color} stroke="var(--card-bg)" strokeWidth="1.5"/>
        </svg>
        {yLabels}
      </div>
    </div>
  );
}

function MemBar({ used, total }: { used: number; total: number }) {
  const pct=(used/total)*100;
  const color=pct>85?"#f25c54":pct>60?"#f5c542":"var(--teal)";
  return (
    <div>
      <div style={{ height:6, borderRadius:3, background:"var(--divider)", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.6s" }}/>
      </div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-faint)", marginTop:4 }}>
        {fmtBytes(used)} / {fmtBytes(total)} ({pct.toFixed(0)}%)
      </div>
    </div>
  );
}

function HWRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ paddingBottom:12, borderBottom:"1px solid var(--divider)" }}>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600, color:"var(--text)" }}>{value}</div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats]     = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [lastUp, setLastUp]   = useState<Date | null>(null);
  const [history, setHistory] = useState<DataPoint[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const busy = useRef(false);

  const fetch_ = useCallback(async (silent = false) => {
    if (busy.current) return;
    busy.current = true;
    if (!silent) setLoading(true);
    try {
      const r = await fetch("/api/stats", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const d: ServerStats = await r.json();
      setStats(d); setLastUp(new Date()); setError(false);
      setHistory(prev => {
        const now = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
        return [...prev, { time: now, latency: d.dbLatency }].slice(-20);
      });
    } catch { setError(true); }
    finally { if (!silent) setLoading(false); busy.current = false; }
  }, []);

  const manualRefresh = useCallback(() => {
    if (busy.current) return;
    // reset 30s timer on manual refresh
    if (timer.current) clearInterval(timer.current);
    fetch_();
    timer.current = setInterval(() => fetch_(true), 30000);
  }, [fetch_]);

  useEffect(() => {
    fetch_();
    timer.current = setInterval(() => fetch_(true), 30000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [fetch_]);

const healthy = stats && stats.dbLatency < 300;
  const statusColor = error ? "#f25c54" : healthy ? "var(--teal)" : "#f5c542";

  return (
    <>
      <Navbar />
      {loading && <PageLoader />}
      <main className="main" style={{ maxWidth:960 }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <a href="/" className="btn-back" style={{ marginBottom:18, textDecoration:"none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            BACK
          </a>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <h1 style={{ fontFamily:"var(--font-mono)", fontSize:28, fontWeight:700, color:"var(--text)", margin:0, letterSpacing:"-0.01em" }}>STATUS</h1>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-faint)", marginTop:5 }}>
                {lastUp ? `Updated ${lastUp.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}` : "Fetching..."}
                {" · "}
                <span onClick={manualRefresh} style={{ color:"var(--teal)", cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3 }}>Refresh</span>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, border:"2px solid var(--border-color)", borderRadius:10, padding:"8px 16px", background:"var(--card-bg)", boxShadow:"3px 3px 0 var(--border-color)" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:statusColor, boxShadow:`0 0 8px ${statusColor}` }}/>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:700, color:"var(--text)" }}>
                {error ? "Error" : healthy ? "Operational" : "Degraded"}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ border:"2.5px solid #f25c54", borderRadius:12, padding:"14px 20px", background:"rgba(242,92,84,0.08)", fontFamily:"var(--font-mono)", fontSize:12, color:"#f25c54", marginBottom:24 }}>
            ⚠ Could not reach the server. Retrying every 30s.
          </div>
        )}

        {stats && (
          <>
            {/* Stat cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(155px, 1fr))", gap:12, marginBottom:16 }}>
              {[
                { label:"Snippets", value:fmtNum(stats.snippets), sub:"public" },
                { label:"Members",  value:fmtNum(stats.users) },
                { label:"Views",    value:fmtNum(stats.views) },
                { label:"Likes",    value:fmtNum(stats.likes) },
                { label:"Comments", value:fmtNum(stats.comments) },
              ].map(({ label, value, sub }) => (
                <div key={label} style={{ border:"2.5px solid var(--border-color)", borderRadius:12, padding:"16px 18px", background:"var(--card-bg)", boxShadow:"4px 4px 0 var(--border-color)" }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--text-muted)", marginBottom:8 }}>{label}</div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:26, fontWeight:700, color:"var(--text)", lineHeight:1 }}>{value}</div>
                  {sub && <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-faint)", marginTop:4 }}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Activity + Hardware */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 290px", gap:16, marginBottom:0 }} className="stats-main-grid">

              {/* Left col: Activity Flow + Recent Snippets */}
              <div style={{ display:"flex", flexDirection:"column", gap:16, height:"100%" }}>
              {/* Activity Flow */}
              <div style={{ border:"2.5px solid var(--border-color)", borderRadius:12, background:"var(--card-bg)", boxShadow:"4px 4px 0 var(--border-color)", overflow:"hidden" }}>
                <div style={{ padding:"14px 20px", borderBottom:"1.5px solid var(--border-color)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--text-muted)" }}>
                    DB Latency — Activity Flow
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--teal)", boxShadow:"0 0 5px var(--teal)" }}/>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-faint)" }}>LIVE</span>
                  </div>
                </div>
                <div style={{ padding:"14px 16px 12px" }}>
                  <div style={{ marginBottom:14 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:26, fontWeight:700, color: stats.dbLatency<100?"var(--teal)":stats.dbLatency<300?"#f5c542":"#f25c54" }}>
                      {stats.dbLatency}
                    </span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text-faint)", marginLeft:4 }}>ms</span>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, color:stats.dbLatency<100?"var(--teal)":stats.dbLatency<300?"#f5c542":"#f25c54", marginLeft:10, letterSpacing:"0.08em" }}>
                      {stats.dbLatency<100?"● EXCELLENT":stats.dbLatency<300?"● NORMAL":"● DEGRADED"}
                    </span>
                  </div>
                  <div style={{ margin: "0 -2px" }}><LatencyGraph data={history}/></div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--text-faint)", marginTop:6, display:"flex", justifyContent:"space-between" }}>
                    <span>{history[0]?.time ?? "—"}</span>
                    <span>{history[history.length-1]?.time ?? "—"}</span>
                  </div>
                </div>
              </div>

              {/* Recent Snippets */}
              <div style={{ border:"2.5px solid var(--border-color)", borderRadius:12, background:"var(--card-bg)", boxShadow:"4px 4px 0 var(--border-color)", overflow:"hidden", flex:1, display:"flex", flexDirection:"column" }}>
                <div style={{ padding:"14px 20px", borderBottom:"1.5px solid var(--border-color)", fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--text-muted)" }}>
                  Recent Snippets
                </div>
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                  {stats.recentSnippets.map((snip, i) => {
                    const cat = CAT_COLORS[snip.category] ?? CAT_COLORS.Other;
                    return (
                      <a key={snip.id} href={`/code?v=${snip.filename}`} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", gap:12, textDecoration:"none", flex:1, minHeight:48, borderBottom: i<stats.recentSnippets.length-1?"1px solid var(--divider)":"none", background:"transparent", transition:"background .12s" }}
                        onMouseOver={e=>(e.currentTarget.style.background="var(--hover-bg)")}
                        onMouseOut={e=>(e.currentTarget.style.background="transparent")}
                      >
                        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, padding:"3px 7px", borderRadius:5, background:cat.bg, color:cat.text, whiteSpace:"nowrap", flexShrink:0 }}>{snip.category}</span>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{snip.title}</span>
                        </div>
                        <div style={{ display:"flex", gap:14, flexShrink:0, fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-faint)" }}>
                          <span>{snip.views} views</span>
                          <span>{fmtDate(snip.createdAt)}</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
              </div>{/* end left col */}

              {/* Hardware & Environment */}
              <div style={{ border:"2.5px solid var(--border-color)", borderRadius:12, background:"var(--card-bg)", boxShadow:"4px 4px 0 var(--border-color)", overflow:"hidden" }}>
                <div style={{ padding:"14px 20px", borderBottom:"1.5px solid var(--border-color)", fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--text-muted)" }}>Hardware & Environment</div>
                <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
                  <HWRow label="CPU"      value={stats.hardware.cpu}/>
                  <HWRow label="Cores"    value={`${stats.hardware.cpuCores} logical cores`}/>
                  <HWRow label="Region"   value={stats.hardware.region.toUpperCase()}/>
                  <HWRow label="Runtime"  value={`Node ${stats.hardware.nodeVersion}`}/>
                  <HWRow label="Platform" value={stats.hardware.platform}/>
                  <div style={{ paddingBottom:12, borderBottom:"1px solid var(--divider)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:6 }}>Memory</div>
                    <MemBar used={stats.hardware.usedMem} total={stats.hardware.totalMem}/>
                  </div>
                  <div style={{ paddingBottom:12, borderBottom:"1px solid var(--divider)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:6 }}>Heap</div>
                    <MemBar used={stats.hardware.heapUsed} total={stats.hardware.heapTotal}/>
                  </div>
                  <div style={{ paddingBottom:12, borderBottom:"1px solid var(--divider)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:4 }}>Uptime</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:stats.uptime>3600?"var(--teal)":"#f5c542" }}>{fmtUp(stats.uptime)}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:4 }}>Load Avg (1m / 5m)</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--text)" }}>{stats.hardware.loadAvg1.toFixed(2)} / {stats.hardware.loadAvg5.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>


          </>
        )}
      </main>
      <style suppressHydrationWarning>{`
        @media (max-width: 700px) { .stats-main-grid { grid-template-columns: 1fr !important; } }
        :root { --graph-bg: rgba(255,255,255,0.02); --grid-line: rgba(255,255,255,0.06); }
        [data-theme="light"] { --graph-bg: rgba(0,0,0,0.02); --grid-line: rgba(0,0,0,0.08); }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </>
  );
}