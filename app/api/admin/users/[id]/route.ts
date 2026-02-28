import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// PUT - update username and/or password
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const target = await prisma.admin.findUnique({ where: { id: params.id } });
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Cannot edit another SUPERADMIN
    if (target.role === "SUPERADMIN" && target.id !== session.id) {
      return NextResponse.json({ error: "Cannot edit another superadmin" }, { status: 403 });
    }

    const { username, password } = await req.json();
    const updateData: Record<string, string> = {};

    if (username && username !== target.username) {
      if (username.length < 3) {
        return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
      }
      const existing = await prisma.admin.findUnique({ where: { username } });
      if (existing) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      updateData.username = username;
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.admin.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, username: true, role: true, createdAt: true, _count: { select: { snippets: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE - remove admin
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const target = await prisma.admin.findUnique({ where: { id: params.id } });
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Cannot delete yourself or another SUPERADMIN
    if (target.id === session.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }
    if (target.role === "SUPERADMIN") {
      return NextResponse.json({ error: "Cannot delete a superadmin" }, { status: 403 });
    }

    await prisma.admin.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}