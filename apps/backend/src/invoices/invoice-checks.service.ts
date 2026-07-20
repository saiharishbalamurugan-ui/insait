import { Injectable } from "@nestjs/common";
import { DiscrepancyType, Severity } from "database";
import { PrismaService } from "../prisma/prisma.service";
import { holidaysInRange } from "./holiday-calendar";
import { ExtractableField, ExtractedInvoiceData } from "./invoice-extraction.service";

const PAYMENT_TERMS_DAYS = 45;
const STANDARD_WEEKLY_HOURS = 40;
const HOURS_PER_HOLIDAY = 8;
const SUBMISSION_DATE_TOLERANCE_DAYS = 14;
const DUE_DATE_TOLERANCE_DAYS = 1;

export type CheckRule = "APPROVED_HOURS" | "BILLING_RATE" | "HOLIDAY_HOURS" | "SUBMISSION_DATE" | "DUE_DATE";

export interface CheckResult {
  rule: CheckRule;
  label: string;
  status: "passed" | "flagged" | "skipped";
  discrepancyType: DiscrepancyType | null;
  severity: Severity | null;
  expectedValue: string | null;
  actualValue: string | null;
  explanation: string;
  relatedFields: ExtractableField[];
  overpayImpact: number;
}

interface RosterMatch {
  employeeName: string;
  hours: number;
  hourlyRate: number;
  country: string;
  weekStart: Date | null;
  weekEnd: Date | null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class InvoiceChecksService {
  constructor(private readonly prisma: PrismaService) {}

  async runChecks(
    data: ExtractedInvoiceData,
    organizationId: string,
    uploadedAt: Date,
    month: string,
  ): Promise<CheckResult[]> {
    const roster = await this.findRosterMatch(data, organizationId, month);

    return [
      this.checkApprovedHours(data, roster),
      this.checkBillingRate(data, roster),
      this.checkHolidayHours(data, roster),
      this.checkSubmissionDate(data, uploadedAt),
      this.checkDueDate(data, uploadedAt),
    ];
  }

  private async findRosterMatch(
    data: ExtractedInvoiceData,
    organizationId: string,
    month: string,
  ): Promise<RosterMatch | null> {
    if (!data.consultantName) return null;

    const candidates = await this.prisma.timesheet.findMany({
      where: { organizationId, month, employeeName: { equals: data.consultantName, mode: "insensitive" } },
      orderBy: { workDate: "desc" },
    });
    if (candidates.length === 0) return null;

    // Prefer a roster row whose week overlaps the invoice's billing period, if we have one
    if (data.periodStart && data.periodEnd) {
      const periodStart = new Date(data.periodStart);
      const periodEnd = new Date(data.periodEnd);
      const overlapping = candidates.find(
        (c) => c.weekStart && c.weekEnd && c.weekStart <= periodEnd && c.weekEnd >= periodStart,
      );
      if (overlapping) {
        return {
          employeeName: overlapping.employeeName,
          hours: Number(overlapping.hours),
          hourlyRate: Number(overlapping.hourlyRate),
          country: overlapping.country,
          weekStart: overlapping.weekStart,
          weekEnd: overlapping.weekEnd,
        };
      }
    }

    const latest = candidates[0];
    return {
      employeeName: latest.employeeName,
      hours: Number(latest.hours),
      hourlyRate: Number(latest.hourlyRate),
      country: latest.country,
      weekStart: latest.weekStart,
      weekEnd: latest.weekEnd,
    };
  }

  private checkApprovedHours(data: ExtractedInvoiceData, roster: RosterMatch | null): CheckResult {
    const rule: CheckRule = "APPROVED_HOURS";
    const label = "Approved Hours";

    if (data.hours === null) {
      return this.skipped(rule, label, "No hours billed on this invoice.");
    }
    if (!roster) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.MISSING_TIMESHEET,
        severity: Severity.HIGH,
        expectedValue: "Roster entry required",
        actualValue: `${data.hours} hrs`,
        explanation: `${data.consultantName ?? "This consultant"} has no matching entry in the uploaded hours sheet — can't verify ${data.hours} billed hours against anything approved.`,
        relatedFields: ["hours", "consultantName"],
        overpayImpact: data.hours * (data.hourlyRate ?? 0),
      };
    }
    if (roster.hours !== data.hours) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.HOURS_MISMATCH,
        severity: Math.abs(roster.hours - data.hours) >= 8 ? Severity.HIGH : Severity.MEDIUM,
        expectedValue: `${roster.hours} hrs (approved)`,
        actualValue: `${data.hours} hrs (billed)`,
        explanation: `The invoice bills ${data.hours} hours for ${roster.employeeName}, but the approved hours sheet shows only ${roster.hours} hours for the matching period.`,
        relatedFields: ["hours"],
        overpayImpact: Math.max(0, data.hours - roster.hours) * (data.hourlyRate ?? roster.hourlyRate),
      };
    }
    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: `${roster.hours} hrs`,
      actualValue: `${data.hours} hrs`,
      explanation: `Billed hours match the approved hours sheet exactly (${data.hours} hrs).`,
      relatedFields: ["hours"],
      overpayImpact: 0,
    };
  }

  private checkBillingRate(data: ExtractedInvoiceData, roster: RosterMatch | null): CheckResult {
    const rule: CheckRule = "BILLING_RATE";
    const label = "Billing Rate";

    if (data.hourlyRate === null) {
      return this.skipped(rule, label, "No hourly rate stated on this invoice.");
    }
    if (!roster) {
      return this.skipped(rule, label, "No roster entry to verify the contracted rate against.");
    }
    if (roster.hourlyRate !== data.hourlyRate) {
      const expectedAmount = roster.hours * roster.hourlyRate;
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.RATE_MISMATCH,
        severity: Severity.HIGH,
        expectedValue: `$${roster.hourlyRate}/hr (expected total $${expectedAmount.toFixed(2)})`,
        actualValue: `$${data.hourlyRate}/hr`,
        explanation: `The invoice bills at $${data.hourlyRate}/hr, but the approved rate for ${roster.employeeName} is $${roster.hourlyRate}/hr — an unauthorized rate change.`,
        relatedFields: ["hourlyRate", "amount"],
        overpayImpact: Math.max(0, data.hourlyRate - roster.hourlyRate) * roster.hours,
      };
    }
    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: `$${roster.hourlyRate}/hr`,
      actualValue: `$${data.hourlyRate}/hr`,
      explanation: `Billing rate matches the approved contracted rate ($${data.hourlyRate}/hr).`,
      relatedFields: ["hourlyRate"],
      overpayImpact: 0,
    };
  }

  private checkHolidayHours(data: ExtractedInvoiceData, roster: RosterMatch | null): CheckResult {
    const rule: CheckRule = "HOLIDAY_HOURS";
    const label = "Holiday Hours";

    const weekStart = roster?.weekStart ?? (data.periodStart ? new Date(data.periodStart) : null);
    const weekEnd = roster?.weekEnd ?? (data.periodEnd ? new Date(data.periodEnd) : null);
    const country = roster?.country ?? "US";

    if (!weekStart || !weekEnd || data.hours === null) {
      return this.skipped(rule, label, "No billing period on the invoice to check against the holiday calendar.");
    }

    const holidays = holidaysInRange(country, weekStart, weekEnd);
    if (holidays.length === 0) {
      return {
        rule,
        label,
        status: "passed",
        discrepancyType: null,
        severity: null,
        expectedValue: "No holidays in this period",
        actualValue: `${data.hours} hrs`,
        explanation: `No ${country} public holidays fall within ${fmtDate(weekStart)}–${fmtDate(weekEnd)}.`,
        relatedFields: ["hours", "periodStart", "periodEnd"],
        overpayImpact: 0,
      };
    }

    // Scale the standard-hours baseline to the actual period length, not a flat 40 —
    // a two-week invoice covers ~80 standard hours before any holiday deduction, not 40.
    const periodDays = daysBetween(weekEnd, weekStart) + 1;
    const periodWeeks = periodDays / 7;
    const expectedMax = Math.round(periodWeeks * STANDARD_WEEKLY_HOURS) - holidays.length * HOURS_PER_HOLIDAY;
    if (data.hours > expectedMax) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.HOLIDAY_OVERBILLING,
        severity: Severity.MEDIUM,
        expectedValue: `≤ ${expectedMax} hrs (${holidays.length} holiday${holidays.length > 1 ? "s" : ""}: ${holidays.join(", ")})`,
        actualValue: `${data.hours} hrs`,
        explanation: `This billing period includes ${holidays.length} ${country} public holiday${holidays.length > 1 ? "s" : ""} (${holidays.join(", ")}), so standard hours should be ≤ ${expectedMax}, but ${data.hours} were billed.`,
        relatedFields: ["hours", "periodStart", "periodEnd"],
        overpayImpact: (data.hours - expectedMax) * (data.hourlyRate ?? roster?.hourlyRate ?? 0),
      };
    }

    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: `≤ ${expectedMax} hrs`,
      actualValue: `${data.hours} hrs`,
      explanation: `Billed hours (${data.hours}) are consistent with the ${holidays.length} holiday${holidays.length > 1 ? "s" : ""} in this period.`,
      relatedFields: ["hours"],
      overpayImpact: 0,
    };
  }

  private checkSubmissionDate(data: ExtractedInvoiceData, uploadedAt: Date): CheckResult {
    const rule: CheckRule = "SUBMISSION_DATE";
    const label = "Submission Date";

    if (!data.issueDate) {
      return this.skipped(rule, label, "No invoice date printed on the document.");
    }

    const issueDate = new Date(data.issueDate);
    const gap = daysBetween(uploadedAt, issueDate);

    if (gap > SUBMISSION_DATE_TOLERANCE_DAYS) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.DATE_MISMATCH,
        severity: Severity.MEDIUM,
        expectedValue: `Within ${SUBMISSION_DATE_TOLERANCE_DAYS} days of ${fmtDate(uploadedAt)}`,
        actualValue: fmtDate(issueDate),
        explanation: `The invoice is dated ${fmtDate(issueDate)}, but it was actually received on ${fmtDate(uploadedAt)} — a ${gap}-day gap, which may indicate backdating.`,
        relatedFields: ["issueDate"],
        overpayImpact: 0,
      };
    }

    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: fmtDate(uploadedAt),
      actualValue: fmtDate(issueDate),
      explanation: `Invoice date (${fmtDate(issueDate)}) is consistent with when it was actually received.`,
      relatedFields: ["issueDate"],
      overpayImpact: 0,
    };
  }

  private checkDueDate(data: ExtractedInvoiceData, uploadedAt: Date): CheckResult {
    const rule: CheckRule = "DUE_DATE";
    const label = "Due Date";

    const expectedDueDate = new Date(uploadedAt.getTime() + PAYMENT_TERMS_DAYS * 86400000);

    if (!data.dueDate) {
      return {
        rule,
        label,
        status: "skipped",
        discrepancyType: null,
        severity: null,
        expectedValue: fmtDate(expectedDueDate),
        actualValue: null,
        explanation: `No due date printed on the invoice. Based on Net ${PAYMENT_TERMS_DAYS} terms from the actual receipt date, it should be ${fmtDate(expectedDueDate)}.`,
        relatedFields: ["dueDate"],
        overpayImpact: 0,
      };
    }

    const statedDueDate = new Date(data.dueDate);
    const gap = Math.abs(daysBetween(statedDueDate, expectedDueDate));

    if (gap > DUE_DATE_TOLERANCE_DAYS) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.DUE_DATE_MISMATCH,
        severity: Severity.LOW,
        expectedValue: `${fmtDate(expectedDueDate)} (Net ${PAYMENT_TERMS_DAYS} from receipt)`,
        actualValue: fmtDate(statedDueDate),
        explanation: `Based on Net ${PAYMENT_TERMS_DAYS} terms from the actual receipt date (${fmtDate(uploadedAt)}), the due date should be ${fmtDate(expectedDueDate)}, but the invoice states ${fmtDate(statedDueDate)}.`,
        relatedFields: ["dueDate"],
        overpayImpact: 0,
      };
    }

    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: fmtDate(expectedDueDate),
      actualValue: fmtDate(statedDueDate),
      explanation: `Due date matches Net ${PAYMENT_TERMS_DAYS} terms calculated from the actual receipt date.`,
      relatedFields: ["dueDate"],
      overpayImpact: 0,
    };
  }

  private skipped(rule: CheckRule, label: string, reason: string): CheckResult {
    return {
      rule,
      label,
      status: "skipped",
      discrepancyType: null,
      severity: null,
      expectedValue: null,
      actualValue: null,
      explanation: reason,
      relatedFields: [],
      overpayImpact: 0,
    };
  }
}
