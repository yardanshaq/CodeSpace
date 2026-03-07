import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

async function getSnippetFiles(snippetId: string) {
  try {
    const ids = await redis.get<string[]>(`snippet:files:${snippetId}`);
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const metas = await Promise.all(
      ids.map(id =>
        redis.get<{ id: string; name: string; mimeType: string; size: number }>(
          `file:meta:${id}`
        )
      )
    );
    return metas.filter(Boolean);
  } catch {
    return [];
  }
}

// GET — returns snippet + likeCount + liked + comments + files in one shot
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const idOrFilename = params.id;
    const session = await getSession();

    // Resolve to actual snippet first (supports both UUID and filename)
    const snippet = await prisma.snippet.findFirst({
      where: { OR: [{ id: idOrFilename }, { filename: idOrFilename }] },
      include: { admin: { select: { username: true } } },
    });

    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const snippetId = snippet.id; // always UUID from here

    // Run remaining queries in parallel with resolved UUID
    const [likeCount, userLike, comments, files] = await Promise.all([
      prisma.like.count({ where: { snippetId } }),
      session
        ? prisma.like.findUnique({
            where: { snippetId_userId: { snippetId, userId: session.id } },
          })
        : Promise.resolve(null),
      prisma.comment.findMany({
        where: { snippetId },
        include: { user: { select: { username: true, role: true } } },
        orderBy: { createdAt: "asc" },
      }),
      getSnippetFiles(snippetId),
    ]);

    return NextResponse.json({
      snippet,
      likeCount,
      liked: !!userLike,
      comments,
      files,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}