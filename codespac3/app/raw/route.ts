import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Sanitize filename for use in Content-Disposition header value.
// Strips CR/LF (header injection) and double-quotes (attribute break).
function safeFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_");
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("v");

  if (!id) {
    return new NextResponse("Missing ?v= parameter", { status: 400 });
  }

  try {
    const snippet =
      (await prisma.snippet.findUnique({
        where: { filename: id },
        select: { code: true, filename: true, isPublic: true, adminId: true },
      })) ??
      (await prisma.snippet.findUnique({
        where: { id },
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
        "Content-Disposition": `inline; filename="${safeFilename(snippet.filename)}"`,  // sanitized: no CR/LF/quotes
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Server error", { status: 500 });
  }
}