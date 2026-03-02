import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── Rate limiting per IP ────────────────────────────────────────────────────
// Maksimal 3 akun per IP per jam
const registerAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_HOUR = 3;
const WINDOW_MS    = 24 * 60 * 60 * 1000; // 1 jam

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now  = Date.now();
  const entry = registerAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    registerAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_PER_HOUR) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// Bersihkan entry lama tiap 10 menit supaya tidak memory leak
setInterval(() => {
  const now = Date.now();
  registerAttempts.forEach((entry, ip) => {
    if (now > entry.resetAt) registerAttempts.delete(ip);
  });
}, 10 * 60 * 1000);

// ─── Toggle registrasi via env var ──────────────────────────────────────────
// Set REGISTRATION_OPEN=false di Vercel Environment Variables untuk tutup registrasi
// tanpa perlu redeploy kode
function isRegistrationOpen(): boolean {
  const val = process.env.REGISTRATION_OPEN;
  if (!val) return true;             // default: terbuka
  return val.toLowerCase() !== "false" && val !== "0";
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Cek apakah registrasi sedang dibuka
    if (!isRegistrationOpen()) {
      return NextResponse.json(
        { error: "Registration is currently closed." },
        { status: 403 }
      );
    }

    // Rate limit per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed, retryAfterSec } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many registrations from this IP. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).` },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    const { username, password } = await req.json();

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }
    if (username.length < 3 || username.length > 32) {
      return NextResponse.json({ error: "Username must be 3–32 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Only letters, numbers, and underscores allowed" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Cek batas total akun (opsional — cegah DB penuh)
    const MAX_TOTAL_ACCOUNTS = parseInt(process.env.MAX_ACCOUNTS || "500");
    const totalAccounts = await prisma.admin.count();
    if (totalAccounts >= MAX_TOTAL_ACCOUNTS) {
      return NextResponse.json(
        { error: "Registration is currently unavailable." },
        { status: 503 }
      );
    }

    const existing = await prisma.admin.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const member = await prisma.admin.create({
      data: { username, password: hashed, role: Role.MEMBER },
      select: { id: true, username: true, role: true },
    });

    return NextResponse.json({ success: true, user: member });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}