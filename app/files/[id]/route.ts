import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const file = await prisma.globalFile.findUnique({
    where: { id: params.id },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Cek apakah file ini dipakai di snippet public atau private
  const attachment = await prisma.snippetFile.findFirst({
    where: { globalFileId: params.id },
    include: { snippet: { select: { isPublic: true } } },
  });

  // Jika file tidak terikat snippet manapun, atau snippet-nya private -> butuh auth
  const isPublic = attachment?.snippet?.isPublic === true;
  if (!isPublic) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return new NextResponse(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.name}"`,
      "Content-Length": String(file.size),
      "Cache-Control": isPublic ? "public, max-age=31536000" : "private, no-cache",
    },
  });
}