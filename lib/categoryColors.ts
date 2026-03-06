// Shared category color map — used on home, snippet, post, and trending pages.
// Text color is always #000 (black) for contrast on all these backgrounds.

export const CATEGORY_COLORS: Record<string, string> = {
  AI:         "#f5c542",
  Anime:      "#f472b6",
  Converter:  "#60a5fa",
  Downloader: "#f25c54",
  Generator:  "#fb923c",
  Other:      "#94a3b8",
  Random:     "#a78bfa",
  Scrape:     "#4ecdc4",
  Search:     "#818cf8",
  Tools:      "#4ade80",
  Translate:  "#34d399",
  Uploader:   "#fbbf24",
};

/** Returns inline style object for a category badge */
export function categoryStyle(category: string): React.CSSProperties {
  const bg = CATEGORY_COLORS[category] ?? "#94a3b8";
  return {
    background:    bg,
    color:         "#000",
    border:        "1.5px solid rgba(0,0,0,0.15)",
    borderRadius:  6,
    padding:       "3px 9px",
    fontSize:      10,
    fontWeight:    700,
    letterSpacing: "0.05em",
    display:       "inline-block",
    width:         "fit-content",
    fontFamily:    "var(--font-mono)",
  };
}