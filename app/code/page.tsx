import { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SnippetClient from "../snippet/[id]/SnippetClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://codespace.yardansh.com";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { v?: string };
}): Promise<Metadata> {
  const id = searchParams.v;
  if (!id) return { title: "CodeSpace", description: "A code snippet sharing platform" };

  try {
    const snippet = await prisma.snippet.findFirst({
      where: { OR: [{ id }, { filename: id }], isPublic: true },
      select: {
        title:    true,
        filename: true,
        category: true,
        admin:    { select: { username: true } },
      },
    });

    if (!snippet) return { title: "CodeSpace", description: "A code snippet sharing platform" };

    const desc = `${snippet.category} snippet by ${snippet.admin.username} — ${snippet.filename}`;

    return {
      title: snippet.title,
      description: desc,
      openGraph: {
        title:       snippet.title,
        description: desc,
        url:         `${BASE_URL}/code?v=${snippet.filename}`,
        siteName:    "CodeSpace",
        type:        "website",
        images: [{
          url:    "https://cdn.nekohime.site/file/E_fVqMJ-.png",
          width:  1280,
          height: 640,
          alt:    snippet.title,
        }],
      },
      twitter: {
        card:        "summary_large_image",
        title:       snippet.title,
        description: desc,
        images:      ["https://cdn.nekohime.site/file/E_fVqMJ-.png"],
      },
    };
  } catch {
    return { title: "CodeSpace", description: "A code snippet sharing platform" };
  }
}

export default function CodePage({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const id = searchParams.v;
  if (!id) redirect("/");
  return <SnippetClient id={id} />;
}