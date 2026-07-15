import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { riskLabel } from "../common/risk.util";

const DEMO_ORG_ID = "seed-org-1";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: DEMO_ORG_ID },
      include: {
        matchedTimesheet: true,
        auditReports: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const total = invoices.length;
    const totalValue = invoices.reduce((s, i) => s + Number(i.amount), 0);

    let approved = 0;
    let flagged = 0;
    let highRisk = 0;
    let savings = 0;

    for (const inv of invoices) {
      if (inv.status !== "AUDITED") continue;
      const riskScore = inv.auditReports[0]?.overallRiskScore ?? null;
      const label = riskLabel(riskScore);
      if (label === "Approved") approved++;
      else if (label === "Flagged") flagged++;
      else highRisk++;

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

    // Monthly volume trend (last 6 months, counting by issueDate)
    const monthBuckets: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-US", { month: "short" });
      const count = invoices.filter((inv) => {
        const iss = inv.issueDate;
        return iss.getFullYear() === d.getFullYear() && iss.getMonth() === d.getMonth();
      }).length;
      monthBuckets.push({ label, value: count });
    }

    return {
      total,
      totalValue,
      approved,
      flagged,
      highRisk,
      savings,
      monthlyVolume: monthBuckets,
    };
  }
}
