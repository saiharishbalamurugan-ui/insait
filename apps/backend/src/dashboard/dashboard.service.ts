import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { riskLabel } from "../common/risk.util";

const DEMO_ORG_ID = "seed-org-1";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(month?: string) {
    const allInvoices = await this.prisma.invoice.findMany({
      where: { organizationId: DEMO_ORG_ID },
      include: {
        matchedTimesheet: true,
        auditReports: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    // Headline numbers are scoped to the selected month; the volume trend chart
    // below stays all-time so the bars are actually meaningful across months.
    const invoices = month ? allInvoices.filter((inv) => inv.month === month) : allInvoices;

    const total = invoices.length;
    const totalValue = invoices.reduce((s, i) => s + Number(i.amount), 0);

    // "Approved"/"Pending Approval"/"Rejected" below are the human decision
    // (Invoice.approvalStatus) — deliberately not the AI's own risk label, which is a
    // different concept that happens to also use the word "Approved" for a clean risk score.
    let approved = 0;
    let pendingApproval = 0;
    let rejected = 0;
    let lowRisk = 0; // AI risk label "Approved" (clean score) — for the Risk Distribution chart only
    let flagged = 0;
    let highRisk = 0;
    let savings = 0;

    for (const inv of invoices) {
      if (inv.approvalStatus === "APPROVED") approved++;
      else if (inv.approvalStatus === "REJECTED") rejected++;
      else pendingApproval++;

      if (inv.status !== "AUDITED") continue;
      const riskScore = inv.auditReports[0]?.overallRiskScore ?? null;
      const label = riskLabel(riskScore);
      if (label === "Approved") lowRisk++;
      else if (label === "Flagged") flagged++;
      else if (label === "High Risk") highRisk++;

      const reportOverpay = inv.auditReports[0]?.overpayEstimate;
      const timesheetAmount = inv.matchedTimesheet
        ? Number(inv.matchedTimesheet.hours) * Number(inv.matchedTimesheet.hourlyRate)
        : null;
      const overpay =
        reportOverpay !== null && reportOverpay !== undefined
          ? Number(reportOverpay)
          : timesheetAmount !== null
            ? Math.max(0, Number(inv.amount) - timesheetAmount)
            : 0;
      if (label !== "Approved") savings += overpay;
    }

    // Monthly volume trend (last 6 workspace months, counting by the same `month` field
    // used everywhere else — not issueDate, which is a different date printed on the
    // invoice and could disagree with which workspace month it was actually uploaded into).
    const monthBuckets: { label: string; value: number }[] = [];
    const anchor = month ?? new Date().toISOString().slice(0, 7);
    const [anchorYear, anchorMonth] = anchor.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(anchorYear, anchorMonth - 1 - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      const count = allInvoices.filter((inv) => inv.month === key).length;
      monthBuckets.push({ label, value: count });
    }

    return {
      total,
      totalValue,
      approved,
      pendingApproval,
      rejected,
      lowRisk,
      flagged,
      highRisk,
      savings,
      monthlyVolume: monthBuckets,
    };
  }
}
