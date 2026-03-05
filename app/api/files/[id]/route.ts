import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// MIME types that must not be served inline (XSS risk)
const BLOCKED_INLINE_MIME = new Set([
  "text/html", "text/xml", "application/xml", "application/xhtml+xml",
  "image/svg+xml", "application/javascript", "text/javascript", "application/json",
]);

function safeMime(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return BLOCKED_INLINE_MIME.has(base) ? "application/octet-stream" : mimeType;
}

// GET — public, no login required
// Redis keys: file:meta:{id} and file:data:{id}
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meta = await redis.get<{ name: string; mimeType: string; size: number }>(
      `file:meta:${params.id}`
    );
    if (!meta) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const b64 = await redis.get<string>(`file:data:${params.id}`);
    if (!b64) {
      return NextResponse.json({ error: "File data not found" }, { status: 404 });
    }

    const buffer = Buffer.from(b64, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": safeMime(meta.mimeType),
        "Content-Disposition": `inline; filename="${meta.name.replace(/[\r\n"]/g, "_")}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=31536000",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}