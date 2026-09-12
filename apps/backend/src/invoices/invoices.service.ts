import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiAuditQueueService } from "../queue/ai-audit-queue.service";
import { InvoiceChecksService, CheckResult } from "./invoice-checks.service";
import { ExtractedLineItem } from "./invoice-extraction.service";
import { matchConfidence, riskLabel } from "../common/risk.util";
import { MonthsService } from "../months/months.service";

const DEMO_ORG_ID = "seed-org-1";

const SEVERITY_WEIGHT: Record<string, number> = { CRITICAL: 40, HIGH: 25, MEDIUM: 15, LOW: 8 };

function riskScoreFromChecks(checks: CheckResult[]): number {
  const issues = checks.filter((c) => c.status === "flagged" || c.status === "warning");
  if (issues.length === 0) return Math.max(1, Math.round(Math.random() * 4));
  const score = issues.reduce((sum, c) => sum + (SEVERITY_WEIGHT[c.severity ?? "LOW"] ?? 8), 0);
  return Math.min(99, score);
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditQueue: AiAuditQueueService,
    private readonly monthsService: MonthsService,
  ) {}

  private async loadInvoices(where: Record<string, unknown> = {}) {
    return this.prisma.invoice.findMany({
      where: { organizationId: DEMO_ORG_ID, ...where },
      include: {
        matchedTimesheet: true,
        auditReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { findings: true },
        },
      },
      orderBy: { issueDate: "desc" },
    });
  }

  private serialize(invoice: Awaited<ReturnType<InvoicesService["loadInvoices"]>>[number]) {
    const latestReport = invoice.auditReports[0] ?? null;
    const riskScore = latestReport?.overallRiskScore ?? null;
    const invoiceAmount = Number(invoice.amount);
    const timesheetAmount = invoice.matchedTimesheet
      ? Number(invoice.matchedTimesheet.hours) * Number(invoice.matchedTimesheet.hourlyRate)
      : null;
    const overpay =
      invoice.status === "AUDITED"
        ? latestReport?.overpayEstimate !== null && latestReport?.overpayEstimate !== undefined
          ? Number(latestReport.overpayEstimate)
          : timesheetAmount !== null
            ? Math.max(0, invoiceAmount - timesheetAmount)
            : 0
        : 0;

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      vendorName: invoice.vendorName,
      consultantName: invoice.consultantName,
      project: invoice.project,
      managerName: invoice.managerName,
      amount: invoiceAmount,
      hours: invoice.hours ? Number(invoice.hours) : null,
      hourlyRate: invoice.hourlyRate ? Number(invoice.hourlyRate) : null,
      issueDate: invoice.issueDate,
      status: invoice.status,
      riskScore,
      riskLabel: invoice.status === "AUDITED" ? riskLabel(riskScore) : null,
      confidence: riskScore !== null ? matchConfidence(riskScore) : null,
      overpay,
      source: invoice.source,
      month: invoice.month,
      approvalStatus: invoice.approvalStatus,
    };
  }

  async findAll(params: { status?: string; approvalStatus?: string; search?: string; month?: string }) {
    const where = params.month ? { month: params.month } : {};
    const invoices = await this.loadInvoices(where);
    let list = invoices.map((inv) => this.serialize(inv));

    if (params.status && params.status !== "all") {
      list = list.filter((inv) => inv.riskLabel === params.status || inv.status === params.status);
    }
    if (params.approvalStatus) {
      list = list.filter((inv) => inv.approvalStatus === params.approvalStatus);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((inv) =>
        [inv.invoiceNumber, inv.consultantName, inv.vendorName, inv.project]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }

  async approvalCounts(month?: string) {
    const where = { organizationId: DEMO_ORG_ID, ...(month ? { month } : {}) };
    const [pendingApproval, approved, rejected] = await Promise.all([
      this.prisma.invoice.count({ where: { ...where, approvalStatus: "PENDING_APPROVAL" } }),
      this.prisma.invoice.count({ where: { ...where, approvalStatus: "APPROVED" } }),
      this.prisma.invoice.count({ where: { ...where, approvalStatus: "REJECTED" } }),
    ]);
    return { pendingApproval, approved, rejected };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId: DEMO_ORG_ID },
      include: {
        lineItems: true,
        matchedTimesheet: true,
        auditReports: {
          orderBy: { createdAt: "desc" },
          include: { findings: true },
        },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const latestReport = invoice.auditReports[0] ?? null;
    const extracted = invoice.extractedData as { checks?: CheckResult[] } | null;
    return {
      ...this.serialize(invoice as any),
      fileUrl: invoice.fileUrl,
      extractedFieldPositions: invoice.extractedFieldPositions,
      checks: Array.isArray(extracted?.checks) ? extracted.checks : null,
      lineItems: invoice.lineItems.map((li) => ({
        id: li.id,
        consultantName: li.consultantName,
        description: li.description,
        quantity: li.quantity !== null ? Number(li.quantity) : null,
        rate: li.rate !== null ? Number(li.rate) : null,
        amount: Number(li.amount),
      })),
      matchedTimesheet: invoice.matchedTimesheet
        ? {
            id: invoice.matchedTimesheet.id,
            employeeName: invoice.matchedTimesheet.employeeName,
            hours: Number(invoice.matchedTimesheet.hours),
            hourlyRate: Number(invoice.matchedTimesheet.hourlyRate),
            project: invoice.matchedTimesheet.project,
            managerName: invoice.matchedTimesheet.managerName,
            workDate: invoice.matchedTimesheet.workDate,
          }
        : null,
      latestReport: latestReport
        ? {
            id: latestReport.id,
            status: latestReport.status,
            overallRiskScore: latestReport.overallRiskScore,
            summary: latestReport.summary,
            reviewAction: latestReport.reviewAction,
            reviewedAt: latestReport.reviewedAt,
            completedAt: latestReport.completedAt,
            findings: latestReport.findings.map((f) => ({
              id: f.id,
              discrepancyType: f.discrepancyType,
              severity: f.severity,
              explanation: f.explanation,
              expectedValue: f.expectedValue,
              actualValue: f.actualValue,
            })),
          }
        : null,
    };
  }

  async triggerAudit(id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, organizationId: DEMO_ORG_ID } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    await this.monthsService.assertCurrent(invoice.month);

    await this.prisma.invoice.update({ where: { id }, data: { status: "PROCESSING" } });
    const job = await this.auditQueue.enqueueAudit(id);
    return { jobId: job.id, status: "PROCESSING" };
  }

  async deleteOne(id: string, actorName?: string, actorUserId?: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, organizationId: DEMO_ORG_ID } });
    if (!invoice) throw new NotFoundException("Invoice not found");
    await this.monthsService.assertCurrent(invoice.month);

    // The deletion log is a separate table with no FK to Invoice (see schema comment) so it
    // survives the delete below — that's the whole point of logging it.
    await this.prisma.invoiceDeletionLog.create({
      data: {
        organizationId: DEMO_ORG_ID,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendorName: invoice.vendorName,
        month: invoice.month,
        actorUserId: actorUserId?.trim() || null,
        actorName: actorName?.trim() || null,
      },
    });
    await this.prisma.invoice.delete({ where: { id } });

    return { deleted: true };
  }

  async bulkDelete(ids: string[]) {
    const currentMonth = await this.monthsService.currentLabel();
    const result = await this.prisma.invoice.deleteMany({
      where: { id: { in: ids }, organizationId: DEMO_ORG_ID, month: currentMonth },
    });
    return { deleted: result.count };
  }

  async create(
    data: {
      vendorName: string;
      invoiceNumber: string;
      consultantName: string | null;
      project: string | null;
      hours: number | null;
      hourlyRate: number | null;
      amount: number;
      issueDate: string;
      dueDate: string | null;
      periodStart: string | null;
      periodEnd: string | null;
      paymentTermsLabel: string | null;
      paymentTermsDays: number | null;
      fileUrl: string | null;
      uploadedAt: string;
      receivedDate: string;
      extractedData: unknown;
      lineItems?: ExtractedLineItem[];
    },
    checksService: InvoiceChecksService,
  ) {
    const lineItems = data.lineItems ?? [];
    const hasLineItem = data.hours !== null && data.hourlyRate !== null;
    const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date(data.uploadedAt);
    const currentMonth = await this.monthsService.currentLabel();

    const fieldPositions =
      data.extractedData && typeof data.extractedData === "object" && "fieldPositions" in data.extractedData
        ? (data.extractedData as { fieldPositions: unknown }).fieldPositions
        : null;

    // A single top-level consultantName can't represent an invoice that bills multiple people —
    // when the extraction left it null but the line items name more than one person, show all of
    // them rather than leaving the field blank on the invoice.
    const distinctLineConsultants = Array.from(
      new Set(lineItems.map((li) => li.consultantName).filter((n): n is string => !!n)),
    );
    const consultantName = data.consultantName ?? (distinctLineConsultants.length > 0 ? distinctLineConsultants.join(", ") : null);

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: DEMO_ORG_ID,
        month: currentMonth,
        vendorName: data.vendorName,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        issueDate: new Date(data.issueDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        source: "MANUAL_UPLOAD",
        status: "AUDITED",
        consultantName,
        project: data.project,
        hours: data.hours,
        hourlyRate: data.hourlyRate,
        fileUrl: data.fileUrl,
        extractedData: data.extractedData as never,
        extractedFieldPositions: fieldPositions as never,
        lineItems:
          lineItems.length > 0
            ? {
                create: lineItems.map((li) => ({
                  consultantName: li.consultantName,
                  description: li.description,
                  quantity: li.hours,
                  rate: li.hourlyRate,
                  amount: li.amount,
                })),
              }
            : hasLineItem
              ? {
                  create: [
                    {
                      description: data.project ? `${data.project} — consulting hours` : "Consulting hours",
                      quantity: data.hours!,
                      rate: data.hourlyRate!,
                      amount: data.amount,
                    },
                  ],
                }
              : undefined,
      },
    });

    const checks = await checksService.runChecks(
      {
        vendorName: data.vendorName,
        invoiceNumber: data.invoiceNumber,
        consultantName: data.consultantName,
        project: data.project,
        hours: data.hours,
        hourlyRate: data.hourlyRate,
        amount: data.amount,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        paymentTermsLabel: data.paymentTermsLabel,
        paymentTermsDays: data.paymentTermsDays,
        lineItems,
        fieldPositions: [],
        fileUrl: data.fileUrl ?? "",
        mimeType: "",
      },
      DEMO_ORG_ID,
      receivedDate,
      currentMonth,
      invoice.id,
    );

    const issueChecks = checks.filter((c) => c.status === "flagged" || c.status === "warning");
    const riskScore = riskScoreFromChecks(checks);
    const statusLabel = riskLabel(riskScore);
    const overpayEstimate = issueChecks.reduce((sum, c) => sum + c.overpayImpact, 0);

    await this.prisma.auditReport.create({
      data: {
        invoiceId: invoice.id,
        status: "COMPLETED",
        overallRiskScore: riskScore,
        overpayEstimate,
        summary:
          issueChecks.length === 0
            ? `${statusLabel} — all ${checks.length} checks passed.`
            : `${statusLabel} — ${issueChecks.length} of ${checks.length} checks need attention: ${issueChecks.map((c) => c.label).join(", ")}.`,
        completedAt: new Date(),
        findings: {
          create: issueChecks.map((c) => ({
            discrepancyType: c.discrepancyType!,
            severity: c.severity!,
            explanation: c.explanation,
            expectedValue: c.expectedValue,
            actualValue: c.actualValue,
          })),
        },
      },
    });

    return this.findOne(invoice.id);
  }
}
