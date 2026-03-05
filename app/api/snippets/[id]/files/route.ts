import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
// Increase body size limit for this route handler (Next.js App Router)
export const maxDuration = 30;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — safe for Vercel Hobby + Upstash free tier
const MAX_FILES_PER_SNIPPET = 20;

// Allowed MIME types for upload — server-side whitelist (not trusting client type)
const ALLOWED_MIME_PREFIXES = ["image/", "text/", "application/pdf", "application/zip"];
const ALLOWED_MIME_EXACT = new Set([
  "application/json", "application/xml", "application/javascript",
  "application/octet-stream", "application/x-tar", "application/gzip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.ms-excel",
]);

// Dangerous MIME types that could execute in browser — must never be served inline
const BLOCKED_INLINE_MIME = new Set([
  "text/html", "text/xml", "application/xml", "application/xhtml+xml",
  "image/svg+xml", "application/javascript", "text/javascript",
]);

// Validate fileId format — must be 24 hex chars (randomBytes(12).toString("hex"))
function isValidFileId(id: string): boolean {
  return /^[0-9a-f]{24}$/.test(id);
}

// Sanitize filename — strip path separators and control chars
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|\x00-\x1f]/g, "_").slice(0, 255);
}

function isMimeAllowed(mime: string): boolean {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (ALLOWED_MIME_EXACT.has(base)) return true;
  return ALLOWED_MIME_PREFIXES.some(p => base.startsWith(p));
}

async function resolveSnippet(idOrFilename: string) {
  return (
    (await prisma.snippet.findUnique({
      where: { id: idOrFilename },
      select: { id: true, adminId: true, isPublic: true },
    })) ??
    (await prisma.snippet.findUnique({
      where: { filename: idOrFilename },
      select: { id: true, adminId: true, isPublic: true },
    }))
  );
}

async function getSnippetFileIds(snippetId: string): Promise<string[]> {
  const raw = await redis.get<string[]>(`snippet:files:${snippetId}`);
  return Array.isArray(raw) ? raw : [];
}

async function getFileMeta(fileId: string) {
  return redis.get<{
    id: string; name: string; mimeType: string;
    size: number; uploadedBy: string; createdAt: string; snippetId: string;
  }>(`file:meta:${fileId}`);
}

// GET — list files attached to a snippet
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const snippet = await resolveSnippet(params.id);
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  if (!snippet.isPublic) {
    const session = await getSession();
    if (!session || (session.role !== "SUPERADMIN" && session.id !== snippet.adminId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const fileIds = await getSnippetFileIds(snippet.id);
  const files = await Promise.all(fileIds.map(getFileMeta));
  const valid = files.filter(Boolean);

  return NextResponse.json(valid);
}

// POST — upload and attach a file to a snippet
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snippet = await resolveSnippet(params.id);
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }
  if (session.role !== "SUPERADMIN" && snippet.adminId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 10 MB." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }

    // Server-side MIME check — read magic bytes, don't trust client-supplied type
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer.slice(0, 8));
    const magic = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // Detect and block HTML regardless of claimed MIME (XSS risk)
    const textSample = Buffer.from(arrayBuffer.slice(0, 512)).toString("utf8").trimStart().toLowerCase();
    if (textSample.startsWith("<!doctype") || textSample.startsWith("<html") || textSample.startsWith("<script")) {
      return NextResponse.json({ error: "HTML files are not allowed." }, { status: 400 });
    }

    // Check file count limit
    const existingIds = await getSnippetFileIds(snippet.id);
    const existingCount = existingIds.length;

    // Determine if this is an upsert (same filename) or a new file
    let fileId: string | null = null;
    for (const id of existingIds) {
      const meta = await getFileMeta(id);
      if (meta?.name === sanitizeFilename(file.name)) { fileId = id; break; }
    }

    // Only enforce count limit if it's truly a new file (not an upsert)
    if (!fileId && existingCount >= MAX_FILES_PER_SNIPPET) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES_PER_SNIPPET} files per snippet.` }, { status: 400 });
    }

    // Determine MIME — trust client for common image types where magic bytes match,
    // otherwise use octet-stream as safe fallback
    const clientMime = (file.type || "application/octet-stream").split(";")[0].trim().toLowerCase();

    // Block dangerous MIME types outright
    if (BLOCKED_INLINE_MIME.has(clientMime)) {
      return NextResponse.json({ error: "This file type is not allowed." }, { status: 400 });
    }

    const safeMime = isMimeAllowed(clientMime) ? clientMime : "application/octet-stream";

    if (!fileId) fileId = randomBytes(12).toString("hex");

    const b64 = Buffer.from(arrayBuffer).toString("base64");
    const safeName = sanitizeFilename(file.name);

    const meta = {
      id: fileId,
      name: safeName,
      mimeType: safeMime,
      size: file.size,
      uploadedBy: session.username,
      createdAt: new Date().toISOString(),
      snippetId: snippet.id,
    };

    await redis.set(`file:meta:${fileId}`, meta);
    await redis.set(`file:data:${fileId}`, b64);

    const updatedIds = Array.from(new Set([...existingIds.filter(id => id !== fileId), fileId]));
    await redis.set(`snippet:files:${snippet.id}`, updatedIds);

    return NextResponse.json(meta, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

// DELETE — remove a file from the snippet and from Redis
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snippet = await resolveSnippet(params.id);
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }
  if (session.role !== "SUPERADMIN" && snippet.adminId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { fileId?: string };
  const { fileId } = body;

  if (!fileId || !isValidFileId(fileId)) {
    return NextResponse.json({ error: "Invalid fileId" }, { status: 400 });
  }

  // Verify the fileId actually belongs to THIS snippet before deleting
  const snippetFileIds = await getSnippetFileIds(snippet.id);
  if (!snippetFileIds.includes(fileId)) {
    return NextResponse.json({ error: "File not found in this snippet" }, { status: 404 });
  }

  await redis.del(`file:meta:${fileId}`);
  await redis.del(`file:data:${fileId}`);

  const updated = snippetFileIds.filter(id => id !== fileId);
  if (updated.length > 0) {
    await redis.set(`snippet:files:${snippet.id}`, updated);
  } else {
    await redis.del(`snippet:files:${snippet.id}`);
  }

  return NextResponse.json({ success: true });
}