import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import PostClient from "./PostClient";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  const session = await getSession();

  // Kalau belum login, redirect ke login langsung dari server — tanpa flash loading
  if (!session) redirect("/login");

  const snippets = await prisma.snippet.findMany({
    where: session.role === "SUPERADMIN" ? {} : { adminId: session.id },
    include: {
      admin: { select: { username: true } },
      attachments: {
        include: {
          globalFile: { select: { id: true, name: true, mimeType: true, size: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const initialUser = {
    id: session.id,
    username: session.username,
    role: session.role,
  };

  return (
    <PostClient
      initialSnippets={JSON.parse(JSON.stringify(snippets.map((s) => ({
        ...s,
        attachments: s.attachments.map((a) => a.globalFile),
      }))))}
      initialUser={initialUser}
    />
  );
}