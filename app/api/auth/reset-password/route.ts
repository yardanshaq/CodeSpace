import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// GET — validate token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false });

  const record = await prisma.passwordReset.findUnique({
    where: { token },
    include: { admin: { select: { username: true } } },
  });

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, username: record.admin.username });
}

// POST — reset password
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (password.length < 6)  return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const record = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.admin.update({
        where: { id: record.adminId },
        data:  { password: hashed },
      }),
      prisma.passwordReset.update({
        where: { id: record.id },
        data:  { used: true },
      }),
      // Invalidate all sessions after password reset
      prisma.session.deleteMany({
        where: { adminId: record.adminId },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}