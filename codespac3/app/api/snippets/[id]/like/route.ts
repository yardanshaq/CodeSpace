import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — fetch like count + whether current user has liked
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const snippetId = params.id;

    const count = await prisma.like.count({ where: { snippetId } });

    let liked = false;
    if (session) {
      const existing = await prisma.like.findUnique({
        where: { snippetId_userId: { snippetId, userId: session.id } },
      });
      liked = !!existing;
    }

    return NextResponse.json({ count, liked });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — toggle like (requires auth)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Login required to like snippets" }, { status: 401 });
    }

    const snippetId = params.id;

    // Check snippet exists
    const snippet = await prisma.snippet.findUnique({ where: { id: snippetId } });
    if (!snippet) {
      return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
    }

    const existing = await prisma.like.findUnique({
      where: { snippetId_userId: { snippetId, userId: session.id } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
    } else {
      await prisma.like.create({ data: { snippetId, userId: session.id } });
    }

    const count = await prisma.like.count({ where: { snippetId } });
    return NextResponse.json({ liked: !existing, count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}