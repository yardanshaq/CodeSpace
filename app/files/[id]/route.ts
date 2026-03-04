import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// MIME types that can execute scripts or cause XSS when served inline.
// These are forced to application/octet-stream so the browser downloads
// them rather than rendering/executing them.
const BLOCKED_INLINE_MIME = new Set([
  "text/html",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
  "image/svg+xml",       // SVG can contain <script>
  "application/javascript",
  "text/javascript",
  "application/json",    // served as download to prevent XSSI
]);

function safeMime(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return BLOCKED_INLINE_MIME.has(base) ? "application/octet-stream" : mimeType;
}

// Sanitize a filename for use inside a Content-Disposition header value.
// Strips CR/LF (header injection) and double-quotes (attribute break).
function safeFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const file = await prisma.globalFile.findUnique({
    where: { id: params.id },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Cek apakah file ini dipakai di snippet public atau private
  const attachment = await prisma.snippetFile.findFirst({
    where: { globalFileId: params.id },
    include: { snippet: { select: { isPublic: true } } },
  });

  // Jika file tidak terikat snippet manapun, atau snippet-nya private -> butuh auth
  const isPublic = attachment?.snippet?.isPublic === true;
  if (!isPublic) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers: {
      // Dangerous MIME types are downgraded to force a download
      "Content-Type": safeMime(file.mimeType),
      // Sanitized filename prevents CR/LF header injection and quote-breaking
      "Content-Disposition": `inline; filename="${safeFilename(file.name)}"`,
      "Content-Length": String(file.size),
      "Cache-Control": isPublic ? "public, max-age=31536000" : "private, no-cache",
      // Belt-and-suspenders: prevent MIME sniffing even with explicit Content-Type
      "X-Content-Type-Options": "nosniff",
    },
  });
}