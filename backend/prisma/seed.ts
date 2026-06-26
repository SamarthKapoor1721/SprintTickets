import dotenv from "dotenv";
import {
  Prisma,
  PrismaClient,
  ProjectStatus,
  ReviewPriority,
  ReviewStatus,
  UserRole,
} from "@prisma/client";

import { hashPassword } from "../src/lib/password";

dotenv.config();

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error(
    "backend/.env is missing DATABASE_URL and/or JWT_SECRET. Copy backend/.env.example to backend/.env and fill in the Neon connection string.",
  );
}

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";

const USERS = [
  {
    email: "ceo@erh.dev",
    fullName: "Alex Carter",
    role: UserRole.ceo,
    department: "Executive",
  },
  {
    email: "manager@erh.dev",
    fullName: "Jordan Lee",
    role: UserRole.manager,
    department: "Engineering",
  },
  {
    email: "employee@erh.dev",
    fullName: "Sam Rivera",
    role: UserRole.employee,
    department: "Engineering",
  },
] as const;

async function getOrCreateUser(input: (typeof USERS)[number]) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      department: input.department,
      isActive: true,
      hashedPassword: hashPassword(DEMO_PASSWORD),
    },
  });
}

async function getOrCreateProject(name: string, ownerId: number) {
  const existing = await prisma.project.findFirst({ where: { name } });
  if (existing) {
    return existing;
  }

  return prisma.project.create({
    data: {
      name,
      ownerId,
      description: "Internal review platform replacing ad-hoc Slack approvals.",
      department: "Engineering",
      status: ProjectStatus.active,
    },
  });
}

async function getOrCreateReview(
  title: string,
  data: Prisma.ReviewRequestUncheckedCreateInput,
) {
  const existing = await prisma.reviewRequest.findFirst({ where: { title } });
  if (existing) {
    return existing;
  }

  return prisma.reviewRequest.create({ data });
}

async function ensureProjectMember(projectId: number, userId: number) {
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId },
    update: {},
  });
}

async function ensureConversationMessages(senderId: number, recipientId: number) {
  const count = await prisma.message.count({
    where: {
      OR: [
        { senderId, recipientId },
        { senderId: recipientId, recipientId: senderId },
      ],
    },
  });

  if (count > 0) {
    return;
  }

  await prisma.message.createMany({
    data: [
      {
        senderId,
        recipientId,
        content: "Great work on the dashboard mockup. Send me the review request when ready.",
      },
      {
        senderId: recipientId,
        recipientId: senderId,
        content: "Will do. I'm finalizing the last details and will submit it shortly.",
      },
    ],
  });
}

async function main() {
  const [ceo, manager, employee] = await Promise.all([
    getOrCreateUser(USERS[0]),
    getOrCreateUser(USERS[1]),
    getOrCreateUser(USERS[2]),
  ]);

  const project = await getOrCreateProject("ERH Platform Revamp", manager.id);

  await Promise.all([
    ensureProjectMember(project.id, employee.id),
    ensureProjectMember(project.id, ceo.id),
  ]);

  await getOrCreateReview("Dashboard redesign - milestone 1", {
    title: "Dashboard redesign - milestone 1",
    summary: "New CEO bird's-eye dashboard with pending/urgent metrics.",
    objective: "Approve the visual direction before building remaining screens.",
    status: ReviewStatus.pending,
    priority: ReviewPriority.high,
    reviewType: "design",
    figmaLink: "https://figma.com/file/demo",
    projectId: project.id,
    submitterId: employee.id,
  });

  await getOrCreateReview("Auth service - JWT login", {
    title: "Auth service - JWT login",
    summary: "Backend authentication endpoints with role-based access.",
    objective: "Confirm the auth flow before wiring the frontend.",
    status: ReviewStatus.approved,
    priority: ReviewPriority.critical,
    reviewType: "backend",
    githubRepo: "https://github.com/erh/backend/pull/12",
    projectId: project.id,
    submitterId: employee.id,
    reviewerId: ceo.id,
  });

  await ensureConversationMessages(ceo.id, employee.id);

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Demo accounts (password: ${DEMO_PASSWORD}):`);
  for (const user of USERS) {
    // eslint-disable-next-line no-console
    console.log(`  ${user.role.padEnd(9)} ${user.email}`);
  }
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
