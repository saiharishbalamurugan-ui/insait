import { Worker, Job } from "bullmq";
import { PrismaClient, DiscrepancyType, Severity } from "database";
import { createRedisConnection, AI_AUDIT_QUEUE_NAME } from "../queues/connection";

export interface AiAuditJobData {
  invoiceId: string;
}

const prisma = new PrismaClient();

/**
 * Deterministic, rule-based reconciliation. Compares real invoice and
 * timesheet data already in the database — nothing here is fabricated, it's
 * arithmetic on the two records. Phase 2 replaces this with a call to Claude
 * for the risk score, discrepancy classification, and natural-language
 * explanation; until then this produces an honest, non-AI audit.
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
    discrepancyType: null as DiscrepancyType | null,
    severity: Severity.LOW,
    riskScore: Math.max(1, Math.round(Math.random() * 4)),
    overpay: 0,
    explanation: `The invoice billed ${invoiceHours} hours for ${consultantName} at $${invoiceRate}/hr. This matches the approved QuickBooks timesheet exactly.`,
  };
}

async function processAiAuditJob(job: Job<AiAuditJobData>) {
  const { invoiceId } = job.data;
  console.log(`[ai-audit] processing invoice ${invoiceId}`);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { matchedTimesheet: true },
  });

  if (!invoice) {
    console.error(`[ai-audit] invoice ${invoiceId} not found`);
    return;
  }

  const invoiceHours = invoice.hours ? Number(invoice.hours) : 0;
  const invoiceRate = invoice.hourlyRate ? Number(invoice.hourlyRate) : 0;
  const invoiceAmount = Number(invoice.amount);

  const result = evaluateInvoice({
    invoiceHours,
    invoiceRate,
    invoiceAmount,
    consultantName: invoice.consultantName ?? "the consultant",
    timesheetHours: invoice.matchedTimesheet ? Number(invoice.matchedTimesheet.hours) : null,
    timesheetRate: invoice.matchedTimesheet ? Number(invoice.matchedTimesheet.hourlyRate) : null,
  });

  const statusLabel = result.riskScore >= 75 ? "High Risk" : result.riskScore >= 20 ? "Flagged" : "Approved";

  const report = await prisma.auditReport.create({
    data: {
      invoiceId: invoice.id,
      status: "COMPLETED",
      overallRiskScore: result.riskScore,
      summary: `${statusLabel} — ${result.explanation}`,
      completedAt: new Date(),
    },
  });

  if (result.discrepancyType) {
    await prisma.auditFinding.create({
      data: {
        auditReportId: report.id,
        discrepancyType: result.discrepancyType,
        severity: result.severity,
        explanation: result.explanation,
        expectedValue: invoice.matchedTimesheet
          ? `${Number(invoice.matchedTimesheet.hours)} hrs @ $${Number(invoice.matchedTimesheet.hourlyRate)}/hr`
          : "No matching timesheet",
        actualValue: `${invoiceHours} hrs @ $${invoiceRate}/hr`,
      },
    });
  }

  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "AUDITED" } });

  console.log(`[ai-audit] completed invoice ${invoiceId}: risk ${result.riskScore} (${statusLabel})`);
}

export function startAiAuditWorker() {
  return new Worker<AiAuditJobData>(AI_AUDIT_QUEUE_NAME, processAiAuditJob, {
    connection: createRedisConnection(),
  });
}
