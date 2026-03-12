import { Metadata } from "next";
import { redirect } from "next/navigation";
import SnippetClient from "../snippet/[id]/SnippetClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://codespace.yardansh.com";

export function generateMetadata(): Metadata {
  return {
    title: "CodeSpace",
    description: "a place to share simple snippets",
    openGraph: {
      title:    "CodeSpace",
      description: "a place to share simple snippets",
      siteName: "CodeSpace",
      type:     "website",
      images: [{ url: "https://cdn.nekohime.site/file/E_fVqMJ-.png", width: 1280, height: 640 }],
    },
    twitter: {
      card:   "summary_large_image",
      images: ["https://cdn.nekohime.site/file/E_fVqMJ-.png"],
    },
  };
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