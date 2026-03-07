import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, deleteAllSessions, createSession, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newUsername, newPassword } = await req.json();

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 400 });
    }

    // Verify current password
    const admin = await prisma.admin.findUnique({ where: { id: session.id } });
    if (!admin) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const updateData: Record<string, unknown> = {};

    // Validate and set new username
    if (newUsername && newUsername !== admin.username) {
      if (newUsername.length < 3 || newUsername.length > 32) {
        return NextResponse.json({ error: "Username must be 3–32 characters" }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
        return NextResponse.json({ error: "Only letters, numbers, and underscores allowed" }, { status: 400 });
      }
      const existing = await prisma.admin.findUnique({ where: { username: newUsername } });
      if (existing) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      updateData.username = newUsername;
    }

    // Validate and set new password
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
      }
      if (newPassword === currentPassword) {
        return NextResponse.json({ error: "New password must be different from current" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    await prisma.admin.update({
      where: { id: session.id },
      data: updateData,
    });

    // Invalidate all sessions dan buat sesi baru
    await deleteAllSessions(session.id);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const ua = req.headers.get("user-agent") || undefined;

    const updatedAdmin = await prisma.admin.findUnique({ where: { id: session.id } });
    if (!updatedAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

    const rawToken = await createSession(
      { id: updatedAdmin.id, username: updatedAdmin.username, role: updatedAdmin.role as "SUPERADMIN" | "ADMIN" | "MEMBER" },
      ip,
      ua
    );

    const response = NextResponse.json({
      success: true,
      message: "Settings updated",
      user: { username: updatedAdmin.username, role: updatedAdmin.role },
    });

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}