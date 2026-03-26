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
      ids.map(id => redis.get<{ id: string; name: string; mimeType: string; size: number; uploadedBy: string; createdAt: string }>(`file:meta:${id}`))
    );
    return metas.filter(Boolean);
  } catch {
    return [];
  }
}

async function findSnippet(idOrFilename: string) {
  return (
    (await prisma.snippet.findUnique({ where: { id: idOrFilename } })) ??
    (await prisma.snippet.findUnique({ where: { filename: idOrFilename } }))
  );
}

async function findSnippetWithRelations(idOrFilename: string) {
  const include = { admin: { select: { username: true } } };
  return (
    (await prisma.snippet.findUnique({ where: { id: idOrFilename }, include })) ??
    (await prisma.snippet.findUnique({ where: { filename: idOrFilename }, include }))
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const snippet = await findSnippetWithRelations(params.id);
    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!snippet.isPublic) {
      const session = await getSession();
      const isOwner = session?.id === snippet.adminId;
      const isSuperAdmin = session?.role === "SUPERADMIN";
      if (!session || (!isOwner && !isSuperAdmin)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    return NextResponse.json({
      ...snippet,
      attachments: await getSnippetFiles(snippet.id),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const snippet = await findSnippet(params.id);
    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!snippet.isPublic) {
      const session = await getSession();
      const isOwner = session?.id === snippet.adminId;
      const isSuperAdmin = session?.role === "SUPERADMIN";
      if (!session || (!isOwner && !isSuperAdmin)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    const updated = await prisma.snippet.update({
      where: { id: snippet.id },
      data: {
        views: { increment: 1 },
        updatedAt: snippet.updatedAt, // preserve — views increment should not affect "last edited" timestamp
      },
      select: { views: true },
    });

    // Invalidate SSE cache supaya view count langsung update ke semua client
    try {
      await redis.del(`sse:stats:${snippet.id}`);
    } catch { /* non-fatal */ }

    return NextResponse.json({ views: updated.views });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const snippet = await findSnippet(params.id);
    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (session.role !== "SUPERADMIN" && snippet.adminId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { title, code, category, isPublic } = await req.json();
    if (title !== undefined && (typeof title !== "string" || title.length > 200)) {
      return NextResponse.json({ error: "Title must be under 200 characters" }, { status: 400 });
    }
    if (code !== undefined && (typeof code !== "string" || code.length > 500_000)) {
      return NextResponse.json({ error: "Code must be under 500 KB" }, { status: 400 });
    }
    const filename =
      (title || snippet.title)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") + ".js";
    const updated = await prisma.snippet.update({
      where: { id: snippet.id },
      data: {
        title: title ?? snippet.title,
        filename,
        code: code ?? snippet.code,
        category: category ?? snippet.category,
        isPublic: isPublic !== undefined ? isPublic : snippet.isPublic,
      },
      include: { admin: { select: { username: true } } },
    });
    return NextResponse.json({
      ...updated,
      attachments: await getSnippetFiles(updated.id),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const snippet = await findSnippet(params.id);
    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (session.role !== "SUPERADMIN" && snippet.adminId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Delete Redis files associated with this snippet
    try {
      const fileIds = await redis.get<string[]>(`snippet:files:${snippet.id}`);
      if (Array.isArray(fileIds) && fileIds.length > 0) {
        await Promise.all(fileIds.flatMap(id => [
          redis.del(`file:meta:${id}`),
          redis.del(`file:data:${id}`),
        ]));
        await redis.del(`snippet:files:${snippet.id}`);
      }
    } catch { /* non-fatal */ }

    await prisma.snippet.delete({ where: { id: snippet.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}