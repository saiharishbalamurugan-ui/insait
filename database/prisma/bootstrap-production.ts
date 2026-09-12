// Creates the organization + first ADMIN login for a real deployment — safe to run once
// against a production database. Unlike seed.ts (which wipes and replaces all invoices/
// timesheets with fake demo data on every run, for local dev only), this never touches
// invoice/timesheet data and won't overwrite an existing user.
//
// Run with all four of these set:
//   BOOTSTRAP_ORG_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD
//
// e.g. (from the repo root):
//   BOOTSTRAP_ORG_NAME="Insait Solutions" BOOTSTRAP_ADMIN_EMAIL="you@company.com" \
//   BOOTSTRAP_ADMIN_NAME="Your Name" BOOTSTRAP_ADMIN_PASSWORD="some-temp-password" \
//   npm run bootstrap --workspace=database

import { PrismaClient } from "../generated/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

// Same salt:derived-hex scrypt format apps/backend/src/auth/password.util.ts verifies.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  const orgName = process.env.BOOTSTRAP_ORG_NAME;
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!orgName || !adminEmail || !adminName || !adminPassword) {
    throw new Error(
      "Set BOOTSTRAP_ORG_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and BOOTSTRAP_ADMIN_PASSWORD before running this.",
    );
  }
  if (adminPassword.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD should be at least 8 characters.");
  }

  // "seed-org-1" is hardcoded as DEMO_ORG_ID across the backend (this app is single-tenant
  // today) — not a real seed-data placeholder, the literal id the whole app queries by.
  const org = await prisma.organization.upsert({
    where: { id: "seed-org-1" },
    update: { name: orgName },
    create: { id: "seed-org-1", name: orgName },
  });

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`A user with email ${adminEmail} already exists — nothing to do. Log in normally.`);
    return;
  }

  await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      role: "ADMIN",
      organizationId: org.id,
      passwordHash: hashPassword(adminPassword),
    },
  });

  console.log(`Created organization "${orgName}" and admin account ${adminEmail}.`);
  console.log("Log in with that email/password, then invite everyone else from Settings > Users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
