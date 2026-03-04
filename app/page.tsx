import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [snippets, session] = await Promise.all([
    prisma.snippet.findMany({
      where: { isPublic: true },
      include: { admin: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getSession(),
  ]);

  const initialUser = session
    ? { username: session.username, role: session.role }
    : null;

  return (
    <HomeClient
      initialSnippets={JSON.parse(JSON.stringify(snippets))}
      initialUser={initialUser}
    />
  );
}