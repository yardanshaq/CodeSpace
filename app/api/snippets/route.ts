import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redis } from "@/lib/redis";

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

async function getSnippetFiles(snippetId: string) {
  try {
    const ids = await redis.get<string[]>(`snippet:files:${snippetId}`);
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const metas = await Promise.all(
      ids.map(id =>
        redis.get<{ id: string; name: string; mimeType: string; size: number; uploadedBy: string; createdAt: string }>(`file:meta:${id}`)
      )
    );
    return metas.filter(Boolean);
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";

type SortField = "createdAt" | "title" | "views";
type SortOrder = "asc" | "desc";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const search    = searchParams.get("search") || "";
    const adminView = searchParams.get("adminView") === "true";
    const author    = searchParams.get("author") || "";

    const rawSort  = searchParams.get("sortBy") || "createdAt";
    const rawOrder = searchParams.get("order")  || "desc";
    const sortBy: SortField = (["createdAt", "title", "views"].includes(rawSort)
      ? rawSort
      : "createdAt") as SortField;
    const order: SortOrder = rawOrder === "asc" ? "asc" : "desc";

    let where: Record<string, unknown> = {};

    if (adminView) {
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      where = session.role === "SUPERADMIN" ? {} : { adminId: session.id };
    } else {
      where = { isPublic: true };
    }

    if (search) {
      where = {
        ...where,
        OR: [
          { title:    { contains: search, mode: "insensitive" } },
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
        select: {
          id:          true,
          title:       true,
          filename:    true,
          category:    true,
          isPublic:    true,
          views:       true,
          createdAt:   true,
          updatedAt:   true,
          // ── adminId intentionally excluded from public list ──
          // Only include adminId for authenticated adminView so owner
          // can identify their own snippets client-side if needed.
          ...(adminView && session ? { adminId: true } : {}),
          admin:  { select: { username: true } },
          _count: { select: { likes: true, comments: true } },
          // ── code excluded from list endpoint — fetch via /api/snippets/[id] ──
        },
        orderBy: { [sortBy]: order },
    });

    const snippetsWithFiles = await Promise.all(
      snippets.map(async (s) => ({
        ...s,
        likeCount:    s._count.likes,
        commentCount: s._count.comments,
        attachments:  await getSnippetFiles(s.id),
      }))
    );

    return NextResponse.json(snippetsWithFiles);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ip = getRealIp(req);
    const { allowed, retryAfter } = await checkSnippetRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many snippets created. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { title, code, category, isPublic } = await req.json();
    if (!title || !code) return NextResponse.json({ error: "Title and code required" }, { status: 400 });
    if (typeof title !== "string" || title.length > 200)
      return NextResponse.json({ error: "Title must be under 200 characters" }, { status: 400 });
    if (typeof code !== "string" || code.length > 500_000)
      return NextResponse.json({ error: "Code must be under 500 KB" }, { status: 400 });

    const isMember = session.role === "MEMBER";
    const resolvedIsPublic = isMember ? true : (isPublic !== undefined ? isPublic : true);

    const filename =
      title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + ".js";

    const snippet = await prisma.snippet.create({
      data: { title, filename, code, category: category || "Scrape", isPublic: resolvedIsPublic, adminId: session.id },
      select: {
        id:        true,
        title:     true,
        filename:  true,
        category:  true,
        isPublic:  true,
        views:     true,
        createdAt: true,
        updatedAt: true,
        admin:     { select: { username: true } },
        _count:    { select: { likes: true, comments: true } },
      },
    });

    return NextResponse.json(
      { ...snippet, likeCount: 0, commentCount: 0, attachments: [] },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}