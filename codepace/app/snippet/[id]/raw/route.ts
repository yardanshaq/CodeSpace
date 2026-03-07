import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const snippet =
      (await prisma.snippet.findUnique({
        where: { id: params.id },
        select: { code: true, filename: true, isPublic: true, adminId: true },
      })) ??
      (await prisma.snippet.findUnique({
        where: { filename: params.id },
        select: { code: true, filename: true, isPublic: true, adminId: true },
      }));

    if (!snippet) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (!snippet.isPublic) {
      const session = await getSession();
      const isOwner = session?.id === snippet.adminId;
      const isSuperAdmin = session?.role === "SUPERADMIN";
      if (!session || (!isOwner && !isSuperAdmin)) {
        return new NextResponse("Not found", { status: 404 });
      }
    }

    return new NextResponse(snippet.code, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${snippet.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Server error", { status: 500 });
  }
}