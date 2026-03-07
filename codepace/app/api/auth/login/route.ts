import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";
import { redis } from "@/lib/redis";

// Rate limit via Redis — efektif di serverless (tidak pakai in-memory Map)
// Maksimal 10 percobaan per IP per 15 menit
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 15 * 60; // detik

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `ratelimit:login:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
    if (count > RATE_LIMIT_MAX) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : RATE_LIMIT_WINDOW };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    console.warn("Redis rate limit check failed — allowing request");
    return { allowed: true, retryAfter: 0 };
  }
}

// Ambil IP real — x-real-ip dari Vercel tidak bisa di-spoof user
function getRealIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRealIp(req);
    const ua = req.headers.get("user-agent") || "";

    const { allowed, retryAfter } = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await req.json();
    const { username, password } = body;

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (username.length > 64 || password.length > 256) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const superUsername = process.env.SUPERADMIN_USERNAME;
    const superPassword = process.env.SUPERADMIN_PASSWORD;
    if (!superUsername || !superPassword) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    let dbAdmin = await prisma.admin.findUnique({ where: { username } });

    if (!dbAdmin && username === superUsername && password === superPassword) {
      const hashed = await bcrypt.hash(superPassword, 12);
      dbAdmin = await prisma.admin.create({
        data: { username: superUsername, password: hashed, role: "SUPERADMIN" },
      });
    }

    const fakeHash = "$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn";
    const valid = dbAdmin
      ? await bcrypt.compare(password, dbAdmin.password)
      : await bcrypt.compare(password, fakeHash).then(() => false);

    if (!dbAdmin || !valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Login berhasil — reset counter
    try { await redis.del(`ratelimit:login:${ip}`); } catch { /* ignore */ }

    await prisma.admin.update({
      where: { id: dbAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    const rawToken = await createSession(
      { id: dbAdmin.id, username: dbAdmin.username, role: dbAdmin.role as "SUPERADMIN" | "ADMIN" },
      ip, ua
    );

    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      user: { username: dbAdmin.username, role: dbAdmin.role },
    });

    response.cookies.set(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: "/",
    });
    response.cookies.set("auth_token", "", {
      httpOnly: true, secure: isProduction, sameSite: "strict", maxAge: 0, path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}