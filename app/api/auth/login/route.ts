import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";

const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = req.headers.get("user-agent") || "";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again in 15 minutes." },
        { status: 429 }
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

    await prisma.admin.update({
      where: { id: dbAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    const rawToken = await createSession(
      { id: dbAdmin.id, username: dbAdmin.username, role: dbAdmin.role as "SUPERADMIN" | "ADMIN" },
      ip,
      ua
    );

    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.json({
      success: true,
      user: { username: dbAdmin.username, role: dbAdmin.role },
    });

    // Set cookie session baru
    response.cookies.set(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: "/",
    });

    // Bersihkan cookie JWT lama kalau masih ada di browser pengguna
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}