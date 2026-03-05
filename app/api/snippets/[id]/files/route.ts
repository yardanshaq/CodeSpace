import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Redis key schema:
//   file:meta:{fileId}          → { id, name, mimeType, size, uploadedBy, createdAt, snippetId }
//   file:data:{fileId}          → base64 string
//   snippet:files:{snippetId}   → JSON array of fileId strings
//   (snippetId is always the Prisma id, never the filename)

// Resolve snippet by id or filename — always returns the real Prisma id
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
// Public snippet: no login required. Private snippet: must be logged in as owner or superadmin.
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

    const arrayBuffer = await file.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");

    // Check if a file with the same name already exists in this snippet (upsert by name)
    const existingIds = await getSnippetFileIds(snippet.id);
    let fileId: string | null = null;

    for (const id of existingIds) {
      const meta = await getFileMeta(id);
      if (meta?.name === file.name) { fileId = id; break; }
    }

    if (!fileId) fileId = randomBytes(12).toString("hex");

    const meta = {
      id: fileId,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
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

  const { fileId } = await req.json() as { fileId: string };
  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  await redis.del(`file:meta:${fileId}`);
  await redis.del(`file:data:${fileId}`);

  const ids = await getSnippetFileIds(snippet.id);
  const updated = ids.filter(id => id !== fileId);
  if (updated.length > 0) {
    await redis.set(`snippet:files:${snippet.id}`, updated);
  } else {
    await redis.del(`snippet:files:${snippet.id}`);
  }

  return NextResponse.json({ success: true });
}