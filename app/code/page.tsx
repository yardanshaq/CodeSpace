import { Metadata } from "next";
import { redirect } from "next/navigation";
import SnippetClient from "../snippet/[id]/SnippetClient";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://codespace.yardansh.com";

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
        images: [
          {
            url:    "https://cdn.nekohime.site/file/E_fVqMJ-.png",
            width:  1280,
            height: 640,
            alt:    "CodeSpace Cover",
          },
        ],
      },
      twitter: {
        card:        "summary_large_image",
        title:       snippet.title,
        description: desc,
        images:      ["https://cdn.nekohime.site/file/E_fVqMJ-.png"],
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

  return <SnippetClient id={id} />;
}