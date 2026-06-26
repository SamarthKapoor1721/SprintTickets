import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@sprinttickets.com";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin123";

  console.log(`Ensuring super_admin exists: ${superAdminEmail}`);

  const hashedPassword = bcrypt.hashSync(superAdminPassword, 10);

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      role: UserRole.super_admin,
      hashedPassword,
    },
    create: {
      email: superAdminEmail,
      hashedPassword,
      fullName: "Super Admin",
      role: UserRole.super_admin,
    },
  });

  console.log("Super Admin seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
