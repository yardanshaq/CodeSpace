import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export interface SessionPayload {
  id: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN" | "MEMBER";
}

const COOKIE_NAME = "sid";
const SESSION_TTL_DAYS = 7;

/**
 * Hash token sebelum disimpan ke database.
 * Dengan begitu, kalau database bocor, token yang ada di cookie user
 * tidak bisa langsung dipakai untuk login — karena yang tersimpan hanya hash-nya.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Buat session baru untuk user yang baru login.
 * Token mentah (raw) dikembalikan untuk disimpan di cookie,
 * sedangkan yang masuk ke database adalah versi hash-nya.
 */
export async function createSession(
  admin: SessionPayload,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const rawToken    = randomBytes(32).toString("hex"); // 64-char hex
  const hashedToken = hashToken(rawToken);
  const expiresAt   = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token:     hashedToken,
      adminId:   admin.id,
      ip:        ip ?? null,
      userAgent: userAgent ?? null,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Ambil data session dari cookie yang ada di request saat ini.
 * Mengembalikan null jika session tidak ditemukan atau sudah expired.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const rawToken    = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken || rawToken.length !== 64) return null;

  const hashedToken = hashToken(rawToken);

  try {
    const session = await prisma.session.findUnique({
      where:   { token: hashedToken },
      include: {
        admin: { select: { id: true, username: true, role: true } },
      },
    });

    if (!session) return null;

    // Hapus session yang sudah expired dan tolak request-nya
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { token: hashedToken } }).catch(() => {});
      return null;
    }

    return {
      id:       session.admin.id,
      username: session.admin.username,
      role:     session.admin.role as "SUPERADMIN" | "ADMIN" | "MEMBER",
    };
  } catch {
    return null;
  }
}

/** Hapus session yang sedang aktif (logout). */
export async function deleteSession(): Promise<void> {
  const cookieStore = cookies();
  const rawToken    = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) return;
  const hashedToken = hashToken(rawToken);
  await prisma.session.delete({ where: { token: hashedToken } }).catch(() => {});
}

/** Hapus semua session milik satu user — berguna untuk "logout semua device". */
export async function deleteAllSessions(adminId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { adminId } });
}

export { COOKIE_NAME, SESSION_TTL_DAYS };

/** Tambahkan header Set-Cookie untuk menghapus cookie session di browser. */
export function clearSessionCookie(response: import("next/server").NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   0,
    path:     "/",
  });
}
