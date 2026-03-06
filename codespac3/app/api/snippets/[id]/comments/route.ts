import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// ── Rate limiting: max 10 comments per user per hour ─────────────────────────
async function checkCommentRateLimit(
  userId: string
): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `ratelimit:comment:${userId}`;
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

// ── XSS sanitization: strip all HTML tags and dangerous patterns ──────────────
// React renders comment text as plain text (no dangerouslySetInnerHTML),
// so this is defence-in-depth — nothing with angle brackets reaches the DB.
function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")                     // strip HTML tags
    .replace(/javascript\s*:/gi, "")             // strip js: URIs
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // strip inline event attrs
    .replace(/&[a-z]+;/gi, (m) => {              // decode common HTML entities
      const entities: Record<string, string> = {
        "&lt;": "<", "&gt;": ">", "&amp;": "&",
        "&quot;": '"', "&#x27;": "'", "&#x2F;": "/",
      };
      return entities[m] ?? m;
    })
    .trim();
}

// ── GET — list all comments for a snippet ─────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const comments = await prisma.comment.findMany({
      where: { snippetId: params.id },
      include: { user: { select: { username: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — add a comment (requires auth) ─────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Login required to post comments" },
        { status: 401 }
      );
    }

    // Rate limit per user
    const { allowed, retryAfter } = await checkCommentRateLimit(session.id);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many comments. Try again in ${Math.ceil(
            retryAfter / 60
          )} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { body } = await req.json();
    if (!body || typeof body !== "string") {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    const clean = sanitizeText(body);
    if (clean.length === 0) {
      return NextResponse.json(
        { error: "Comment cannot be empty" },
        { status: 400 }
      );
    }
    if (clean.length > 2000) {
      return NextResponse.json(
        { error: "Comment must be under 2000 characters" },
        { status: 400 }
      );
    }

    const snippet = await prisma.snippet.findUnique({
      where: { id: params.id },
    });
    if (!snippet) {
      return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: { snippetId: params.id, userId: session.id, body: clean },
      include: { user: { select: { username: true, role: true } } },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}