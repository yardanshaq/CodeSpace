import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";

async function findSnippet(idOrFilename: string) {
  return prisma.snippet.findFirst({
    where: { OR: [{ id: idOrFilename }, { filename: idOrFilename }] },
  });
}

async function findSnippetWithRelations(idOrFilename: string) {
  const include = {
    admin: { select: { username: true } },
    attachments: {
      include: {
        globalFile: {
          select: { id: true, name: true, mimeType: true, size: true },
        },
      },
    },
  };
  return prisma.snippet.findFirst({
    where: { OR: [{ id: idOrFilename }, { filename: idOrFilename }] },
    include,
  });
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
      attachments: snippet.attachments.map((a) => a.globalFile),
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
      data: { views: { increment: 1 } },
      select: { views: true },
    });
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
      include: {
        admin: { select: { username: true } },
        attachments: {
          include: {
            globalFile: {
              select: { id: true, name: true, mimeType: true, size: true },
            },
          },
        },
      },
    });
    return NextResponse.json({
      ...updated,
      attachments: updated.attachments.map((a) => a.globalFile),
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
    await prisma.snippet.delete({ where: { id: snippet.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}