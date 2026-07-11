import { Worker, Job } from "bullmq";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient, DiscrepancyType, Severity } from "database";
import { createRedisConnection, AI_AUDIT_QUEUE_NAME } from "../queues/connection";

export interface AiAuditJobData {
  invoiceId: string;
}

const prisma = new PrismaClient();

const CLAUDE_MODEL = "claude-opus-4-8";

interface AuditResult {
  discrepancyType: DiscrepancyType | null;
  severity: Severity;
  riskScore: number;
  overpay: number;
  explanation: string;
}

interface FactSheet {
  consultantName: string;
  project: string | null;
  invoiceHours: number;
  invoiceRate: number;
  invoiceAmount: number;
  timesheetHours: number | null;
  timesheetRate: number | null;
  timesheetAmount: number | null;
  hoursDiff: number | null;
  rateDiff: number | null;
  overpay: number;
}

function buildFactSheet(opts: {
  invoiceHours: number;
  invoiceRate: number;
  invoiceAmount: number;
  consultantName: string;
  project: string | null;
  timesheetHours: number | null;
  timesheetRate: number | null;
}): FactSheet {
  const { invoiceHours, invoiceRate, invoiceAmount, consultantName, project, timesheetHours, timesheetRate } = opts;

  if (timesheetHours === null || timesheetRate === null) {
    return {
      consultantName,
      project,
      invoiceHours,
      invoiceRate,
      invoiceAmount,
      timesheetHours: null,
      timesheetRate: null,
      timesheetAmount: null,
      hoursDiff: null,
      rateDiff: null,
      overpay: invoiceAmount,
    };
  }

  const timesheetAmount = timesheetHours * timesheetRate;
  return {
    consultantName,
    project,
    invoiceHours,
    invoiceRate,
    invoiceAmount,
    timesheetHours,
    timesheetRate,
    timesheetAmount,
    hoursDiff: invoiceHours - timesheetHours,
    rateDiff: invoiceRate - timesheetRate,
    overpay: Math.max(0, invoiceAmount - timesheetAmount),
  };
}

/**
 * Deterministic fallback — used only if ANTHROPIC_API_KEY is missing or the
 * Claude call fails. Real arithmetic on real data, just no AI-generated
 * narrative or judgment.
 */
function evaluateRuleBased(facts: FactSheet): AuditResult {
  if (facts.timesheetHours === null || facts.timesheetRate === null) {
    return {
      discrepancyType: DiscrepancyType.MISSING_TIMESHEET,
      severity: Severity.CRITICAL,
      riskScore: 97,
      overpay: facts.overpay,
      explanation: `${facts.consultantName} does not appear in the QuickBooks timesheet system at all. The invoice claims ${facts.invoiceHours} billed hours, but no approved record exists to validate this consultant's engagement.`,
    };
  }

  const { hoursDiff, rateDiff, overpay } = facts;

  if (rateDiff !== 0 && hoursDiff === 0) {
    const riskScore = Math.min(95, Math.round((overpay / facts.invoiceAmount) * 140) + 15);
    return {
      discrepancyType: DiscrepancyType.RATE_MISMATCH,
      severity: riskScore >= 75 ? Severity.HIGH : Severity.MEDIUM,
      riskScore,
      overpay,
      explanation: `The invoice was billed at $${facts.invoiceRate}/hr, but the approved QuickBooks rate for ${facts.consultantName} is $${facts.timesheetRate}/hr. All ${facts.invoiceHours} hours match the approved timesheet — only the rate is in dispute.`,
    };
  }

  if (hoursDiff !== null && hoursDiff > 0) {
    const riskScore = Math.min(95, Math.round((overpay / facts.invoiceAmount) * 140) + 15);
    return {
      discrepancyType: DiscrepancyType.HOURS_MISMATCH,
      severity: riskScore >= 75 ? Severity.HIGH : Severity.MEDIUM,
      riskScore,
      overpay,
      explanation: `The invoice billed ${facts.invoiceHours} hours for ${facts.consultantName}, but QuickBooks contains only ${facts.timesheetHours} approved hours for the same period. An additional ${hoursDiff} hours were billed but do not appear in the approved timesheet.`,
    };
  }

  return {
    discrepancyType: null,
    severity: Severity.LOW,
    riskScore: Math.max(1, Math.round(Math.random() * 4)),
    overpay: 0,
    explanation: `The invoice billed ${facts.invoiceHours} hours for ${facts.consultantName} at $${facts.invoiceRate}/hr. This matches the approved QuickBooks timesheet exactly.`,
  };
}

const DISCREPANCY_VALUES = Object.values(DiscrepancyType);
const SEVERITY_VALUES = Object.values(Severity);

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    hasDiscrepancy: { type: "boolean" },
    discrepancyType: { type: "string", enum: [...DISCREPANCY_VALUES, "NONE"] },
    severity: { type: "string", enum: [...SEVERITY_VALUES, "NONE"] },
    riskScore: { type: "integer", description: "0-100, where 0 is no risk and 100 is certain overbilling" },
    explanation: {
      type: "string",
      description: "2-3 sentence natural-language explanation of the finding, grounded only in the facts provided",
    },
  },
  required: ["hasDiscrepancy", "discrepancyType", "severity", "riskScore", "explanation"],
  additionalProperties: false,
} as const;

/**
 * Real AI classification: Claude receives the objective facts (hours, rates,
 * amounts, deltas — computed deterministically so it can't misstate the
 * numbers) and produces the risk score, discrepancy classification, and
 * natural-language explanation.
 */
async function evaluateWithClaude(facts: FactSheet): Promise<AuditResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const factsText = facts.timesheetHours === null
    ? `Invoice: ${facts.consultantName}, project "${facts.project}", billed ${facts.invoiceHours} hours at $${facts.invoiceRate}/hr = $${facts.invoiceAmount}.
QuickBooks: no timesheet record found for this consultant at all.`
    : `Invoice: ${facts.consultantName}, project "${facts.project}", billed ${facts.invoiceHours} hours at $${facts.invoiceRate}/hr = $${facts.invoiceAmount}.
QuickBooks approved timesheet: ${facts.timesheetHours} hours at $${facts.timesheetRate}/hr = $${facts.timesheetAmount}.
Computed deltas: hours difference = ${facts.hoursDiff}, rate difference = $${facts.rateDiff}/hr, estimated overpayment = $${facts.overpay}.`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      "You are Audix's invoice audit engine. You review a staffing invoice against its matched QuickBooks-approved " +
      "timesheet and classify any discrepancy. Only use the DiscrepancyType categories provided in the schema. " +
      "Ground your explanation strictly in the numbers given — never invent hours, rates, or dollar amounts not " +
      "present in the input. If the invoice matches the timesheet exactly, set hasDiscrepancy to false and " +
      "discrepancyType/severity to \"NONE\" with a low riskScore.",
    messages: [{ role: "user", content: factsText }],
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text content");

  const parsed = JSON.parse(textBlock.text) as {
    hasDiscrepancy: boolean;
    discrepancyType: string;
    severity: string;
    riskScore: number;
    explanation: string;
  };

  const riskScore = Math.max(0, Math.min(100, Math.round(parsed.riskScore)));
  const discrepancyType = parsed.hasDiscrepancy && DISCREPANCY_VALUES.includes(parsed.discrepancyType as DiscrepancyType)
    ? (parsed.discrepancyType as DiscrepancyType)
    : null;
  const severity = SEVERITY_VALUES.includes(parsed.severity as Severity) ? (parsed.severity as Severity) : Severity.LOW;

  return {
    discrepancyType,
    severity,
    riskScore,
    overpay: facts.overpay,
    explanation: parsed.explanation,
  };
}

async function evaluateInvoice(facts: FactSheet): Promise<{ result: AuditResult; source: "claude" | "rule-based" }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { result: evaluateRuleBased(facts), source: "rule-based" };
  }
  try {
    return { result: await evaluateWithClaude(facts), source: "claude" };
  } catch (err) {
    console.error(`[ai-audit] Claude call failed, falling back to rule-based evaluation:`, (err as Error).message);
    return { result: evaluateRuleBased(facts), source: "rule-based" };
  }
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

  const facts = buildFactSheet({
    invoiceHours,
    invoiceRate,
    invoiceAmount,
    consultantName: invoice.consultantName ?? "the consultant",
    project: invoice.project,
    timesheetHours: invoice.matchedTimesheet ? Number(invoice.matchedTimesheet.hours) : null,
    timesheetRate: invoice.matchedTimesheet ? Number(invoice.matchedTimesheet.hourlyRate) : null,
  });

  const { result, source } = await evaluateInvoice(facts);
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

  console.log(`[ai-audit] completed invoice ${invoiceId} via ${source}: risk ${result.riskScore} (${statusLabel})`);
}

export function startAiAuditWorker() {
  return new Worker<AiAuditJobData>(AI_AUDIT_QUEUE_NAME, processAiAuditJob, {
    connection: createRedisConnection(),
  });
}
