import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@sprinttickets.com";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "admin123";

  const demoEmails = ["ceo@erh.dev", "manager@erh.dev", "employee@erh.dev", "admin@sprinttickets.com"];
  const emailsToDelete = demoEmails.filter((email) => email !== superAdminEmail);

  if (emailsToDelete.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emailsToDelete } },
    });
  }

  const hashedPassword = bcrypt.hashSync(superAdminPassword, 10);

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      role: UserRole.super_admin,
      hashedPassword,
      fullName: "Super Admin",
      department: "Operations",
      onboardingToken: null,
      isActive: true,
    },
    create: {
      email: superAdminEmail,
      hashedPassword,
      fullName: "Super Admin",
      department: "Operations",
      role: UserRole.super_admin,
    },
  });

  console.log(`Seeded super admin account: ${superAdminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
