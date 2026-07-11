import { PrismaClient, DiscrepancyType, Severity } from "../generated/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Deterministic, rule-based reconciliation — NOT an AI call. This mirrors the
 * logic workers/src/processors/ai-audit.processor.ts uses for the "Run AI
 * Audit" flow, so seeded invoices look consistent with freshly-audited ones.
 * Phase 2 replaces both with real Claude-generated findings.
 */
function evaluateInvoice(opts: {
  invoiceHours: number;
  invoiceRate: number;
  invoiceAmount: number;
  consultantName: string;
  timesheetHours: number | null;
  timesheetRate: number | null;
}) {
  const { invoiceHours, invoiceRate, invoiceAmount, consultantName, timesheetHours, timesheetRate } = opts;

  if (timesheetHours === null || timesheetRate === null) {
    return {
      discrepancyType: DiscrepancyType.MISSING_TIMESHEET,
      severity: Severity.CRITICAL,
      riskScore: 97,
      overpay: invoiceAmount,
      explanation: `${consultantName} does not appear in the QuickBooks timesheet system at all. The invoice claims ${invoiceHours} billed hours, but no approved record exists to validate this consultant's engagement.`,
    };
  }

  const hoursDiff = invoiceHours - timesheetHours;
  const rateDiff = invoiceRate - timesheetRate;
  const timesheetAmount = timesheetHours * timesheetRate;
  const overpay = Math.max(0, invoiceAmount - timesheetAmount);

  if (rateDiff !== 0 && hoursDiff === 0) {
    const riskScore = Math.min(95, Math.round((overpay / invoiceAmount) * 140) + 15);
    return {
      discrepancyType: DiscrepancyType.RATE_MISMATCH,
      severity: riskScore >= 75 ? Severity.HIGH : Severity.MEDIUM,
      riskScore,
      overpay,
      explanation: `The invoice was billed at $${invoiceRate}/hr, but the approved QuickBooks rate for ${consultantName} is $${timesheetRate}/hr. All ${invoiceHours} hours match the approved timesheet — only the rate is in dispute.`,
    };
  }

  if (hoursDiff > 0) {
    const riskScore = Math.min(95, Math.round((overpay / invoiceAmount) * 140) + 15);
    return {
      discrepancyType: DiscrepancyType.HOURS_MISMATCH,
      severity: riskScore >= 75 ? Severity.HIGH : Severity.MEDIUM,
      riskScore,
      overpay,
      explanation: `The invoice billed ${invoiceHours} hours for ${consultantName}, but QuickBooks contains only ${timesheetHours} approved hours for the same period. An additional ${hoursDiff} hours were billed but do not appear in the approved timesheet.`,
    };
  }

  return {
    discrepancyType: null,
    severity: Severity.LOW,
    riskScore: Math.max(1, Math.round(Math.random() * 4)),
    overpay: 0,
    explanation: `The invoice billed ${invoiceHours} hours for ${consultantName} at $${invoiceRate}/hr. This matches the approved QuickBooks timesheet exactly.`,
  };
}

function riskStatus(riskScore: number) {
  if (riskScore >= 75) return "High Risk";
  if (riskScore >= 20) return "Flagged";
  return "Approved";
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "seed-org-1" },
    update: {},
    create: { id: "seed-org-1", name: "Meridian Consulting Group" },
  });

  await prisma.user.upsert({
    where: { email: "demo@audix.dev" },
    update: {},
    create: {
      email: "demo@audix.dev",
      name: "Jordan Meyers",
      role: "ADMIN",
      organizationId: org.id,
      passwordHash: hashPassword("demo1234"),
    },
  });

  // Clean slate for invoices/timesheets so the seed is idempotent-ish across reseeds
  await prisma.auditFinding.deleteMany({ where: { auditReport: { invoice: { organizationId: org.id } } } });
  await prisma.auditReport.deleteMany({ where: { invoice: { organizationId: org.id } } });
  await prisma.invoiceLineItem.deleteMany({ where: { invoice: { organizationId: org.id } } });
  await prisma.invoice.deleteMany({ where: { organizationId: org.id } });
  await prisma.timesheet.deleteMany({ where: { organizationId: org.id } });

  type SeedRow = {
    num: string;
    consultantName: string;
    vendorName: string;
    project: string;
    managerName: string;
    invoiceHours: number;
    invoiceRate: number;
    timesheetHours: number | null;
    timesheetRate: number | null;
    daysAgoReceived: number;
    preAudited: boolean;
  };

  const rows: SeedRow[] = [
    { num: "INV-3001", consultantName: "Daniel Ortiz", vendorName: "Meridian Staffing Group", project: "Project Atlas", managerName: "Priya Nair", invoiceHours: 80, invoiceRate: 145, timesheetHours: 80, timesheetRate: 145, daysAgoReceived: 21, preAudited: true },
    { num: "INV-3002", consultantName: "Sofia Álvarez", vendorName: "Meridian Staffing Group", project: "Helix Migration", managerName: "Priya Nair", invoiceHours: 88, invoiceRate: 130, timesheetHours: 80, timesheetRate: 130, daysAgoReceived: 20, preAudited: true },
    { num: "INV-3003", consultantName: "Grace Kim", vendorName: "Apex Talent Partners", project: "Orion Data Platform", managerName: "Linda Chao", invoiceHours: 80, invoiceRate: 165, timesheetHours: 80, timesheetRate: 150, daysAgoReceived: 18, preAudited: true },
    { num: "INV-3004", consultantName: "Ethan Brooks", vendorName: "Apex Talent Partners", project: "Titan ERP Upgrade", managerName: "Linda Chao", invoiceHours: 96, invoiceRate: 135, timesheetHours: 80, timesheetRate: 135, daysAgoReceived: 17, preAudited: true },
    { num: "INV-3005", consultantName: "Owen Fitzgerald", vendorName: "BlueRock Consulting Resources", project: "Nova CRM Rollout", managerName: "Devon Park", invoiceHours: 80, invoiceRate: 128, timesheetHours: null, timesheetRate: null, daysAgoReceived: 15, preAudited: true },
    { num: "INV-3006", consultantName: "Aisha Malik", vendorName: "Sterling Workforce Solutions", project: "Orion Data Platform", managerName: "Linda Chao", invoiceHours: 80, invoiceRate: 142, timesheetHours: 80, timesheetRate: 142, daysAgoReceived: 14, preAudited: true },
    { num: "INV-3007", consultantName: "Derek Huang", vendorName: "Pinnacle IT Staffing", project: "Project Atlas", managerName: "Priya Nair", invoiceHours: 80, invoiceRate: 155, timesheetHours: 80, timesheetRate: 155, daysAgoReceived: 12, preAudited: true },
    { num: "INV-3008", consultantName: "Gita Rao", vendorName: "Crestview Professional Services", project: "Orion Data Platform", managerName: "Tom Reilly", invoiceHours: 82, invoiceRate: 147, timesheetHours: 80, timesheetRate: 147, daysAgoReceived: 10, preAudited: true },
    { num: "INV-3009", consultantName: "Nadia Petrov", vendorName: "BlueRock Consulting Resources", project: "Helix Migration", managerName: "Priya Nair", invoiceHours: 80, invoiceRate: 138, timesheetHours: null, timesheetRate: null, daysAgoReceived: 3, preAudited: false },
    { num: "INV-3010", consultantName: "Carla Jimenez", vendorName: "Sterling Workforce Solutions", project: "Summit Cloud Modernization", managerName: "Devon Park", invoiceHours: 84, invoiceRate: 133, timesheetHours: 80, timesheetRate: 133, daysAgoReceived: 2, preAudited: false },
    { num: "INV-3011", consultantName: "Hassan Ali", vendorName: "Crestview Professional Services", project: "Titan ERP Upgrade", managerName: "Priya Nair", invoiceHours: 80, invoiceRate: 131, timesheetHours: 80, timesheetRate: 131, daysAgoReceived: 1, preAudited: false },
  ];

  const now = new Date();
  let count = 0;

  for (const row of rows) {
    const received = new Date(now.getTime() - row.daysAgoReceived * 86400000);
    const invoiceAmount = row.invoiceHours * row.invoiceRate;

    let timesheet = null;
    if (row.timesheetHours !== null && row.timesheetRate !== null) {
      timesheet = await prisma.timesheet.create({
        data: {
          organizationId: org.id,
          quickbooksId: `qb-${row.num}`,
          employeeName: row.consultantName,
          workDate: received,
          hours: row.timesheetHours,
          hourlyRate: row.timesheetRate,
          project: row.project,
          managerName: row.managerName,
        },
      });
    }

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        vendorName: row.vendorName,
        invoiceNumber: row.num,
        amount: invoiceAmount,
        issueDate: received,
        dueDate: new Date(received.getTime() + 15 * 86400000),
        source: "EMAIL_INGESTION",
        status: row.preAudited ? "AUDITED" : "PENDING",
        consultantName: row.consultantName,
        project: row.project,
        managerName: row.managerName,
        hours: row.invoiceHours,
        hourlyRate: row.invoiceRate,
        matchedTimesheetId: timesheet?.id,
        lineItems: {
          create: [
            {
              description: `${row.project} — consulting hours`,
              quantity: row.invoiceHours,
              rate: row.invoiceRate,
              amount: invoiceAmount,
            },
          ],
        },
      },
    });

    if (row.preAudited) {
      const result = evaluateInvoice({
        invoiceHours: row.invoiceHours,
        invoiceRate: row.invoiceRate,
        invoiceAmount,
        consultantName: row.consultantName,
        timesheetHours: row.timesheetHours,
        timesheetRate: row.timesheetRate,
      });

      const report = await prisma.auditReport.create({
        data: {
          invoiceId: invoice.id,
          status: "COMPLETED",
          overallRiskScore: result.riskScore,
          summary: `${riskStatus(result.riskScore)} — ${result.explanation}`,
          completedAt: received,
        },
      });

      if (result.discrepancyType) {
        await prisma.auditFinding.create({
          data: {
            auditReportId: report.id,
            discrepancyType: result.discrepancyType,
            severity: result.severity,
            explanation: result.explanation,
            expectedValue:
              row.timesheetHours !== null ? `${row.timesheetHours} hrs @ $${row.timesheetRate}/hr` : "No matching timesheet",
            actualValue: `${row.invoiceHours} hrs @ $${row.invoiceRate}/hr`,
          },
        });
      }
    }

    count++;
  }

  console.log(`Seed complete: org "${org.name}", ${count} invoices (${rows.filter((r) => r.preAudited).length} pre-audited, ${rows.filter((r) => !r.preAudited).length} pending live audit)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
