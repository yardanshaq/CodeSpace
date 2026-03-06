import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// ── Rate limiting: max 5 feedback submissions per IP per day ──────────────────
function getRealIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function checkFeedbackRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `ratelimit:feedback:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 86400); // 24h window
    if (count > 5) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : 86400 };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}

// ── XSS sanitization ─────────────────────────────────────────────────────────
function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/&[a-z]+;/gi, (m) => {
      const entities: Record<string, string> = {
        "&lt;": "<", "&gt;": ">", "&amp;": "&",
        "&quot;": '"', "&#x27;": "'", "&#x2F;": "/",
      };
      return entities[m] ?? m;
    })
    .trim();
}

// ── GET — list feedback (SUPERADMIN / ADMIN only) ─────────────────────────────
export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.role !== "SUPERADMIN" && session.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const feedbacks = await prisma.feedback.findMany({
      include: { user: { select: { username: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — submit feedback (auth optional, rate limited by IP) ────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = getRealIp(req);
    const { allowed, retryAfter } = await checkFeedbackRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many submissions. Try again in ${Math.ceil(
            retryAfter / 3600
          )} hour(s).`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const session = await getSession();
    const { body } = await req.json();

    if (!body || typeof body !== "string") {
      return NextResponse.json(
        { error: "Feedback body is required" },
        { status: 400 }
      );
    }

    const clean = sanitizeText(body);
    if (clean.length === 0) {
      return NextResponse.json(
        { error: "Feedback cannot be empty" },
        { status: 400 }
      );
    }
    if (clean.length > 5000) {
      return NextResponse.json(
        { error: "Feedback must be under 5000 characters" },
        { status: 400 }
      );
    }

    const feedback = await prisma.feedback.create({
      data: { body: clean, userId: session?.id ?? null },
      include: { user: { select: { username: true } } },
    });

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}