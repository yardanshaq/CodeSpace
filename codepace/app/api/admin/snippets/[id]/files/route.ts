import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Redis key schema (mirrors app/api/snippets/[id]/files/route.ts):
//   file:meta:{fileId}          → { id, name, mimeType, size, uploadedBy, createdAt, snippetId }
//   snippet:files:{snippetId}   → JSON array of fileId strings

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  const fileIds = await getSnippetFileIds(snippet.id);
  const files = await Promise.all(fileIds.map(getFileMeta));
  const valid = files.filter(Boolean);

  return NextResponse.json(valid);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: params.id },
    select: { adminId: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }
  if (session.role !== "SUPERADMIN" && snippet.adminId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileIds } = await req.json() as { fileIds: string[] };

  if (fileIds && fileIds.length > 0) {
    await redis.set(`snippet:files:${params.id}`, fileIds);
  } else {
    await redis.del(`snippet:files:${params.id}`);
  }

  return NextResponse.json({ success: true });
}