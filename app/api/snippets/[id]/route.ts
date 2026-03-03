import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

// Satu query pakai findFirst + OR — tidak lagi 2 sequential findUnique
async function findSnippetWithRelations(idOrFilename: string) {
  return prisma.snippet.findFirst({
    where: { OR: [{ id: idOrFilename }, { filename: idOrFilename }] },
    include,
  });
}

async function findSnippet(idOrFilename: string) {
  return prisma.snippet.findFirst({
    where: { OR: [{ id: idOrFilename }, { filename: idOrFilename }] },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Jalankan snippet query dan session check secara PARALLEL — hemat 1 round trip DB
    const [snippet, session] = await Promise.all([
      findSnippetWithRelations(params.id),
      getSession(),
    ]);

    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!snippet.isPublic && !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = NextResponse.json({
      ...snippet,
      attachments: snippet.attachments.map((a) => a.globalFile),
    });

    // Cache publik snippet di CDN/browser 10 detik — refresh otomatis tiap 30 detik
    // Private snippet tidak di-cache sama sekali
    if (snippet.isPublic) {
      res.headers.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
    } else {
      res.headers.set("Cache-Control", "private, no-cache");
    }

    return res;
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
    // Jalankan snippet query dan session check secara PARALLEL
    const [snippet, session] = await Promise.all([
      findSnippet(params.id),
      getSession(),
    ]);

    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!snippet.isPublic && !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const [snippet, session] = await Promise.all([
      findSnippet(params.id),
      getSession(),
    ]);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!snippet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (session.role !== "SUPERADMIN" && snippet.adminId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, code, category, isPublic } = await req.json();
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
    const [snippet, session] = await Promise.all([
      findSnippet(params.id),
      getSession(),
    ]);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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