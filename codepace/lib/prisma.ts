import { PrismaClient } from "@prisma/client";

// Simpan satu instance Prisma di global scope agar tidak terjadi
// multiple connection di development (karena Next.js hot-reload).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging hanya aktif di development untuk debugging.
    // Di production dimatikan agar tidak membebani log server.
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
