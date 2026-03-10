import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const MAX_PER_DAY = 3;
const WINDOW_SEC  = 24 * 60 * 60;

function getRealIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const key = `ratelimit:register:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SEC);
    if (count > MAX_PER_DAY) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfterSec: ttl > 0 ? ttl : WINDOW_SEC };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    console.warn("Redis rate limit check failed — allowing request");
    return { allowed: true, retryAfterSec: 0 };
  }
}

function isRegistrationOpen(): boolean {
  const val = process.env.REGISTRATION_OPEN;
  if (!val) return true;
  return val.toLowerCase() !== "false" && val !== "0";
}

export async function POST(req: NextRequest) {
  try {
    if (!isRegistrationOpen()) {
      return NextResponse.json({ error: "Registration is currently closed." }, { status: 403 });
    }

    const ip = getRealIp(req);
    const { allowed, retryAfterSec } = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many registrations from this IP. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const { username, password, email } = await req.json();

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }
    if (username.length < 3 || username.length > 32) {
      return NextResponse.json({ error: "Username must be 3-32 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Only letters, numbers, and underscores allowed" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (email && typeof email === "string") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      }
      const emailTaken = await prisma.admin.findUnique({ where: { email } });
      if (emailTaken) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const MAX_TOTAL_ACCOUNTS = parseInt(process.env.MAX_ACCOUNTS || "500");
    const totalAccounts = await prisma.admin.count();
    if (totalAccounts >= MAX_TOTAL_ACCOUNTS) {
      return NextResponse.json({ error: "Registration is currently unavailable." }, { status: 503 });
    }

    const existing = await prisma.admin.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const member = await prisma.admin.create({
      data: { username, password: hashed, role: Role.MEMBER, ...(email ? { email } : {}) },
      select: { id: true, username: true, role: true },
    });

    return NextResponse.json({ success: true, user: member });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}