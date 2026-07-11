import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { riskLabel } from "../common/risk.util";

const DEMO_ORG_ID = "seed-org-1";
const VALID_ACTIONS = ["APPROVED", "REJECTED", "CLARIFICATION_REQUESTED"] as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: DEMO_ORG_ID, status: "AUDITED" },
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

    return invoices
      .map((inv) => {
        const report = inv.auditReports[0];
        if (!report) return null;
        const label = riskLabel(report.overallRiskScore);
        if (label === "Approved") return null;

        const timesheetAmount = inv.matchedTimesheet
          ? Number(inv.matchedTimesheet.hours) * Number(inv.matchedTimesheet.hourlyRate)
          : null;
        const overpay = timesheetAmount !== null ? Math.max(0, Number(inv.amount) - timesheetAmount) : Number(inv.amount);

        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          vendorName: inv.vendorName,
          consultantName: inv.consultantName,
          project: inv.project,
          issueDate: inv.issueDate,
          riskLabel: label,
          overpay,
          reportId: report.id,
          summary: report.summary,
          reviewAction: report.reviewAction,
          findings: report.findings.map((f) => ({
            discrepancyType: f.discrepancyType,
            severity: f.severity,
            explanation: f.explanation,
          })),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => (b.riskLabel === "High Risk" ? 1 : 0) - (a.riskLabel === "High Risk" ? 1 : 0));
  }

  async setReviewAction(reportId: string, action: string) {
    if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
      throw new BadRequestException(`action must be one of ${VALID_ACTIONS.join(", ")}`);
    }
    const report = await this.prisma.auditReport.findFirst({
      where: { id: reportId, invoice: { organizationId: DEMO_ORG_ID } },
    });
    if (!report) throw new NotFoundException("Audit report not found");

    return this.prisma.auditReport.update({
      where: { id: reportId },
      data: { reviewAction: action as (typeof VALID_ACTIONS)[number], reviewedAt: new Date() },
    });
  }
}
