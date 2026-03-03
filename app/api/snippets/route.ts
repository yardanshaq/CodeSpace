import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redis } from "@/lib/redis";


// Rate limit post snippet — maksimal 10 snippet per IP per jam
async function checkSnippetRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `ratelimit:post-snippet:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > 10) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : 3600 };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}

function getRealIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

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

    // Rate limit — cegah spam snippet
    const ip = getRealIp(req);
    const { allowed, retryAfter } = await checkSnippetRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many snippets created. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
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