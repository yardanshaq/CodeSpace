import { Metadata } from "next";
import { redirect } from "next/navigation";
import SnippetClient from "../snippet/[id]/SnippetClient";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://codespace.yardanshaq.xyz";

const include = {
  admin: { select: { username: true } },
  attachments: {
    include: {
      globalFile: {
        select: { id: true, name: true, mimeType: true, size: true },
      },
    },
  },
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
        admin:    { select: { username: true } },
      },
    });

    if (!snippet) return { title: "CodeSpace", description: "a place to share simple snippets" };

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

  // Fetch snippet dan session di server — data sudah siap saat halaman dirender
  // Client tidak perlu fetch lagi, langsung render konten tanpa loading screen
  const [snippet, session] = await Promise.all([
    prisma.snippet.findFirst({
      where: { OR: [{ id }, { filename: id }] },
      include,
    }),
    getSession(),
  ]);

  // Private snippet: redirect ke home kalau tidak login
  if (snippet && !snippet.isPublic && !session) {
    redirect("/login");
  }

  // Cast ke any karena Prisma return nested type, sedangkan SnippetClient
  // expect flat GlobalFile[] untuk attachments (sudah di-map di bawah)
  const initialData = snippet
    ? {
        ...snippet,
        attachments: snippet.attachments.map((a) => a.globalFile),
      } as any
    : null;

  return <SnippetClient id={id} initialData={initialData} />;
}