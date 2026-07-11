import { PrismaClient } from "../generated/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "seed-org-1" },
    update: {},
    create: {
      id: "seed-org-1",
      name: "Acme Construction Co.",
    },
  });

  await prisma.user.upsert({
    where: { email: "demo@audix.dev" },
    update: {},
    create: {
      email: "demo@audix.dev",
      name: "Demo User",
      role: "ADMIN",
      organizationId: org.id,
      passwordHash: hashPassword("demo1234"),
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: { id: "seed-invoice-1" },
    update: {},
    create: {
      id: "seed-invoice-1",
      organizationId: org.id,
      vendorName: "BuildRight Contractors",
      invoiceNumber: "INV-2049",
      amount: 12450.0,
      issueDate: new Date("2026-06-15"),
      dueDate: new Date("2026-07-15"),
      status: "PENDING",
      lineItems: {
        create: [
          {
            description: "General labor",
            quantity: 80,
            rate: 65,
            amount: 5200,
          },
          {
            description: "Site supervision",
            quantity: 40,
            rate: 95,
            amount: 3800,
          },
          {
            description: "Equipment rental",
            quantity: 1,
            rate: 3450,
            amount: 3450,
          },
        ],
      },
    },
  });

  await prisma.timesheet.upsert({
    where: { quickbooksId: "seed-qb-ts-1" },
    update: {},
    create: {
      quickbooksId: "seed-qb-ts-1",
      organizationId: org.id,
      employeeName: "J. Alvarez",
      workDate: new Date("2026-06-14"),
      hours: 72,
      hourlyRate: 65,
      project: "Acme HQ Retrofit",
    },
  });

  console.log("Seed complete:", { org: org.name, invoice: invoice.invoiceNumber });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
