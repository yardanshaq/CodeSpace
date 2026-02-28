import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const files = await prisma.globalFile.findMany({
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(files);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 10 MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const saved = await prisma.globalFile.upsert({
      where: { name: file.name },
      update: {
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: buffer,
        uploadedBy: session.username,
        updatedAt: new Date(),
      },
      create: {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: buffer,
        uploadedBy: session.username,
      },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        uploadedBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}
