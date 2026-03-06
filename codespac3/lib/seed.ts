import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SUPERADMIN_USERNAME || "superadmin";
  const password = process.env.SUPERADMIN_PASSWORD || "superadmin123";

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log("SuperAdmin already exists");
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.admin.create({
    data: {
      username,
      password: hashed,
      role: "SUPERADMIN",
    },
  });
  console.log(`SuperAdmin created: ${username}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
