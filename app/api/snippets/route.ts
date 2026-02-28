import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const adminView = searchParams.get("adminView") === "true";
    const author = searchParams.get("author") || "";

    let where: Record<string, unknown> = {};

    if (adminView) {
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (session.role === "SUPERADMIN") {
        where = {};
      } else {
        where = { adminId: session.id };
      }
    } else {
      where = { isPublic: true };
    }

    if (search) {
      where = {
        ...where,
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (author) {
      where = {
        ...where,
        admin: { username: { equals: author, mode: "insensitive" } },
      };
    }

    const snippets = await prisma.snippet.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      snippets.map((s) => ({
        ...s,
        attachments: s.attachments.map((a) => a.globalFile),
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, code, category, isPublic } = await req.json();
    if (!title || !code) {
      return NextResponse.json({ error: "Title and code required" }, { status: 400 });
    }

    // MEMBER hanya boleh post public
    const isMember = session.role === "MEMBER";
    const resolvedIsPublic = isMember ? true : (isPublic !== undefined ? isPublic : true);

    const filename = title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") + ".js";

    const snippet = await prisma.snippet.create({
      data: {
        title,
        filename,
        code,
        category: category || "Scrape",
        isPublic: resolvedIsPublic,
        adminId: session.id,
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

    return NextResponse.json(
      { ...snippet, attachments: snippet.attachments.map((a) => a.globalFile) },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}