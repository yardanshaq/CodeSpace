import { Metadata } from "next";
import { redirect } from "next/navigation";
import SnippetClient from "./[id]/SnippetClient";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://codespace.yardanshaq.xyz";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { v?: string };
}): Promise<Metadata> {
  const id = searchParams.v;
  if (!id) return { title: "CodeSpace", description: "a place to share simple snippets" };

  try {
    // Query langsung ke DB — jauh lebih cepat dari HTTP fetch ke diri sendiri
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
        url:         `${BASE_URL}/snippet?v=${snippet.filename}`,
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

export default function SnippetPage({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const id = searchParams.v;
  if (!id) redirect("/");
  return <SnippetClient id={id} />;
}
