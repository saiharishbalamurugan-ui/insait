import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiAuditQueueService } from "../queue/ai-audit-queue.service";
import { matchConfidence, riskLabel } from "../common/risk.util";

const DEMO_ORG_ID = "seed-org-1";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditQueue: AiAuditQueueService,
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
        ? timesheetAmount !== null
          ? Math.max(0, invoiceAmount - timesheetAmount)
          : invoiceAmount
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
    };
  }

  async findAll(params: { status?: string; search?: string }) {
    const invoices = await this.loadInvoices();
    let list = invoices.map((inv) => this.serialize(inv));

    if (params.status && params.status !== "all") {
      list = list.filter((inv) => inv.riskLabel === params.status || inv.status === params.status);
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
    return {
      ...this.serialize(invoice as any),
      fileUrl: invoice.fileUrl,
      lineItems: invoice.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: Number(li.quantity),
        rate: Number(li.rate),
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

    await this.prisma.invoice.update({ where: { id }, data: { status: "PROCESSING" } });
    const job = await this.auditQueue.enqueueAudit(id);
    return { jobId: job.id, status: "PROCESSING" };
  }

  async create(data: {
    vendorName: string;
    invoiceNumber: string;
    consultantName: string | null;
    project: string | null;
    hours: number | null;
    hourlyRate: number | null;
    amount: number;
    issueDate: string;
    dueDate: string | null;
    fileUrl: string | null;
    extractedData: unknown;
  }) {
    const hasLineItem = data.hours !== null && data.hourlyRate !== null;

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: DEMO_ORG_ID,
        vendorName: data.vendorName,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        issueDate: new Date(data.issueDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        source: "MANUAL_UPLOAD",
        status: "PENDING",
        consultantName: data.consultantName,
        project: data.project,
        hours: data.hours,
        hourlyRate: data.hourlyRate,
        fileUrl: data.fileUrl,
        extractedData: data.extractedData as never,
        lineItems: hasLineItem
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

    return this.findOne(invoice.id);
  }
}
