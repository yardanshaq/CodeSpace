import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// MIME types that can execute scripts or cause XSS when served inline.
const BLOCKED_INLINE_MIME = new Set([
  "text/html",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/json",
]);

function safeMime(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return BLOCKED_INLINE_MIME.has(base) ? "application/octet-stream" : mimeType;
}

function safeFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

// GET - public, tidak perlu login
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

  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": safeMime(file.mimeType),
      "Content-Disposition": `inline; filename="${safeFilename(file.name)}"`,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// DELETE - tetap perlu login
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.globalFile.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}