import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// MIME types that must NEVER be served inline — always force download
const BLOCKED_INLINE_MIME = new Set([
  "text/html", "text/xml", "application/xml", "application/xhtml+xml",
  "image/svg+xml", "application/javascript", "text/javascript", "application/json",
]);

// Validate fileId format
function isValidFileId(id: string): boolean {
  return /^[0-9a-f]{24}$/.test(id);
}

function safeDisposition(name: string, inline: boolean): string {
  const safe = name.replace(/[^\w.\-]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${safe}"`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate fileId format first — prevents Redis key injection
    if (!isValidFileId(params.id)) {
      return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    const meta = await redis.get<{
      name: string; mimeType: string; size: number; snippetId: string;
    }>(`file:meta:${params.id}`);

    if (!meta) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Access control: if the parent snippet is private, require auth
    if (meta.snippetId) {
      const snippet = await prisma.snippet.findUnique({
        where: { id: meta.snippetId },
        select: { isPublic: true, adminId: true },
      });
      if (snippet && !snippet.isPublic) {
        const session = await getSession();
        if (!session || (session.role !== "SUPERADMIN" && session.id !== snippet.adminId)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    }

    const b64 = await redis.get<string>(`file:data:${params.id}`);
    if (!b64) {
      return NextResponse.json({ error: "File data not found" }, { status: 404 });
    }

    const buffer = Buffer.from(b64, "base64");

    // Determine safe content-type — block dangerous types
    const baseMime = meta.mimeType.split(";")[0].trim().toLowerCase();
    const isBlocked = BLOCKED_INLINE_MIME.has(baseMime);
    const contentType = isBlocked ? "application/octet-stream" : meta.mimeType;
    const serveInline = !isBlocked && meta.mimeType.startsWith("image/");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": safeDisposition(meta.name, serveInline),
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        "X-Frame-Options": "DENY",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}