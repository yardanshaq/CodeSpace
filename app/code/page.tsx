import { Metadata } from "next";
import { redirect } from "next/navigation";
import SnippetClient from "../snippet/[id]/SnippetClient";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://codespace.yardansh.com";

const include = {
  admin: { select: { username: true } },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { v?: string };
}): Promise<Metadata> {
  const id = searchParams.v;
  if (!id) return { title: "CodeSpace", description: "a place to share simple snippets" };

  try {
    const snippet = await prisma.snippet.findFirst({
      where: { OR: [{ id }, { filename: id }] },
      select: {
        title:    true,
        category: true,
        filename: true,
        isPublic: true,
        admin:    { select: { username: true } },
      },
    });

    // Don't leak private snippet info in OG metadata
    if (!snippet || !snippet.isPublic) return { title: "CodeSpace", description: "a place to share simple snippets" };

    const desc = `${snippet.category} snippet by ${snippet.admin.username} — ${snippet.filename}`;

    return {
      title:       snippet.title,
      description: desc,
      openGraph: {
        title:       snippet.title,
        description: desc,
        url:         `${BASE_URL}/code?v=${snippet.filename}`,
        siteName:    "CodeSpace",
        type:        "website",
      },
      twitter: {
        card:        "summary",
        title:       snippet.title,
        description: desc,
      },
    };
  } catch {
    return { title: "CodeSpace", description: "a place to share simple snippets" };
  }
}

export default async function CodePage({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const id = searchParams.v;
  if (!id) redirect("/");

  const [snippet, session] = await Promise.all([
    prisma.snippet.findFirst({
      where: { OR: [{ id }, { filename: id }] },
      include,
    }),
    getSession(),
  ]);

  // Private snippet: only owner or SUPERADMIN can view
  // Otherwise → show "SNIPPET NOT FOUND", not redirect to login
  let initialData = null;
  if (snippet) {
    if (snippet.isPublic) {
      initialData = { ...snippet, attachments: [] };
    } else {
      const isOwner = session?.id === snippet.adminId;
      const isSuperAdmin = session?.role === "SUPERADMIN";
      if (isOwner || isSuperAdmin) {
        initialData = { ...snippet, attachments: [] };
      }
    }
  }

  return <SnippetClient id={initialData ? (initialData as any).id : id} initialData={initialData as any} />;
}