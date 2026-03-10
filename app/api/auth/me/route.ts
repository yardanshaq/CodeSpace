import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export interface SessionPayload {
  id: string;
  username: string;
  email?: string | null;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

export const COOKIE_NAME = "sid";
const SESSION_TTL_DAYS = 7;
const SESSION_CACHE_TTL = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  admin: SessionPayload,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const rawToken    = randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const expiresAt   = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { token: hashedToken, adminId: admin.id, ip: ip ?? null, userAgent: userAgent ?? null, expiresAt },
  });

  await redis.set(`session:${hashedToken}`, admin, { ex: SESSION_CACHE_TTL }).catch(() => {});
  return rawToken;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const rawToken    = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken || rawToken.length !== 64) return null;

  const hashedToken = hashToken(rawToken);
  const cacheKey    = `session:${hashedToken}`;

  try {
    const cached = await redis.get<SessionPayload>(cacheKey);
    if (cached) return cached;
  } catch {}

  try {
    const session = await prisma.session.findUnique({
      where:   { token: hashedToken },
      include: { admin: { select: { id: true, username: true, email: true, role: true } } },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { token: hashedToken } }).catch(() => {});
      return null;
    }
    const payload: SessionPayload = {
      id: session.admin.id, username: session.admin.username,
      email: session.admin.email,
      role: session.admin.role as SessionPayload["role"],
    };
    await redis.set(cacheKey, payload, { ex: SESSION_CACHE_TTL }).catch(() => {});
    return payload;
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = cookies();
  const rawToken    = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) return;
  const hashedToken = hashToken(rawToken);
  await redis.del(`session:${hashedToken}`).catch(() => {});
  await prisma.session.delete({ where: { token: hashedToken } }).catch(() => {});
}

export async function deleteAllSessions(adminId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { adminId } });
}

export { SESSION_TTL_DAYS };

export function clearSessionCookie(response: import("next/server").NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", maxAge: 0, path: "/",
  });
}