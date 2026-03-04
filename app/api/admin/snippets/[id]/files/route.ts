import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attachments = await prisma.snippetFile.findMany({
    where: { snippetId: params.id },
    include: {
      globalFile: {
        select: { id: true, name: true, mimeType: true, size: true },
      },
    },
  });

  return NextResponse.json(attachments.map((a) => a.globalFile));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verifikasi kepemilikan snippet — MEMBER/ADMIN tidak boleh mengubah
  // attachment snippet milik user lain
  const snippet = await prisma.snippet.findUnique({
    where: { id: params.id },
    select: { adminId: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }
  if (session.role !== "SUPERADMIN" && snippet.adminId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileIds } = await req.json() as { fileIds: string[] };

  await prisma.snippetFile.deleteMany({ where: { snippetId: params.id } });

  if (fileIds && fileIds.length > 0) {
    await prisma.snippetFile.createMany({
      data: fileIds.map((globalFileId) => ({
        snippetId: params.id,
        globalFileId,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ success: true });
}