import { Injectable } from "@nestjs/common";
import { DiscrepancyType, Severity } from "database";
import { PrismaService } from "../prisma/prisma.service";
import { holidaysInRange } from "./holiday-calendar";
import { ExtractableField, ExtractedInvoiceData } from "./invoice-extraction.service";

const STANDARD_WEEKLY_HOURS = 40;
const HOURS_PER_HOLIDAY = 8;
const SUBMISSION_DATE_TOLERANCE_DAYS = 14;
const DUE_DATE_WARNING_DAYS = 3; // 1-3 days off => warning
const REQUIRED_FIELDS: ExtractableField[] = ["vendorName", "invoiceNumber", "amount", "issueDate", "hours", "hourlyRate"];

export type CheckRule =
  | "APPROVED_HOURS"
  | "BILLING_RATE"
  | "HOLIDAY_HOURS"
  | "SUBMISSION_DATE"
  | "DUE_DATE"
  | "DUPLICATE_INVOICE"
  | "MISSING_FIELDS";

export interface CheckResult {
  rule: CheckRule;
  label: string;
  status: "passed" | "warning" | "flagged" | "skipped";
  discrepancyType: DiscrepancyType | null;
  severity: Severity | null;
  expectedValue: string | null;
  actualValue: string | null;
  explanation: string;
  relatedFields: ExtractableField[];
  overpayImpact: number;
  /** Signed day difference (invoice's stated date minus expected), only populated by the Due Date check. */
  diffDays?: number | null;
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
    receivedDate: Date,
    month: string,
    excludeInvoiceId?: string,
  ): Promise<CheckResult[]> {
    const roster = await this.findRosterMatch(data, organizationId, month);

    return [
      this.checkApprovedHours(data, roster),
      this.checkBillingRate(data, roster),
      this.checkHolidayHours(data, roster),
      this.checkSubmissionDate(data, receivedDate),
      this.checkDueDate(data, receivedDate),
      await this.checkDuplicateInvoice(data, organizationId, month, excludeInvoiceId),
      this.checkMissingFields(data),
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

  private checkSubmissionDate(data: ExtractedInvoiceData, receivedDate: Date): CheckResult {
    const rule: CheckRule = "SUBMISSION_DATE";
    const label = "Submission Date";

    if (!data.issueDate) {
      return this.skipped(rule, label, "No invoice date printed on the document.");
    }

    const issueDate = new Date(data.issueDate);
    const gap = daysBetween(receivedDate, issueDate);

    if (gap > SUBMISSION_DATE_TOLERANCE_DAYS) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.DATE_MISMATCH,
        severity: Severity.MEDIUM,
        expectedValue: `Within ${SUBMISSION_DATE_TOLERANCE_DAYS} days of ${fmtDate(receivedDate)}`,
        actualValue: fmtDate(issueDate),
        explanation: `The invoice is dated ${fmtDate(issueDate)}, but the email was received on ${fmtDate(receivedDate)} — a ${gap}-day gap, which may indicate backdating.`,
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
      expectedValue: fmtDate(receivedDate),
      actualValue: fmtDate(issueDate),
      explanation: `Invoice date (${fmtDate(issueDate)}) is consistent with when the email was actually received.`,
      relatedFields: ["issueDate"],
      overpayImpact: 0,
    };
  }

  private checkDueDate(data: ExtractedInvoiceData, receivedDate: Date): CheckResult {
    const rule: CheckRule = "DUE_DATE";
    const label = "Due Date";

    if (data.paymentTermsDays === null) {
      return this.skipped(
        rule,
        label,
        "No payment terms detected on the invoice — enter them manually to validate the due date.",
      );
    }

    const termsLabel = data.paymentTermsLabel ?? `Net ${data.paymentTermsDays}`;
    const expectedDueDate = new Date(receivedDate.getTime() + data.paymentTermsDays * 86400000);

    if (!data.dueDate) {
      return {
        rule,
        label,
        status: "skipped",
        discrepancyType: null,
        severity: null,
        expectedValue: fmtDate(expectedDueDate),
        actualValue: null,
        explanation: `No due date printed on the invoice. Based on the email received date and ${termsLabel} terms, it should be ${fmtDate(expectedDueDate)}.`,
        relatedFields: ["dueDate", "paymentTerms"],
        overpayImpact: 0,
      };
    }

    const statedDueDate = new Date(data.dueDate);
    const diffDays = daysBetween(statedDueDate, expectedDueDate);
    const absDiff = Math.abs(diffDays);
    const diffLabel = diffDays === 0 ? "0 days" : `${diffDays > 0 ? "+" : ""}${diffDays} days`;

    if (absDiff === 0) {
      return {
        rule,
        label,
        status: "passed",
        discrepancyType: null,
        severity: null,
        expectedValue: `${fmtDate(expectedDueDate)} (${termsLabel} from receipt)`,
        actualValue: fmtDate(statedDueDate),
        explanation: `Based on the email received date (${fmtDate(receivedDate)}) and the detected ${termsLabel} terms, the expected due date is ${fmtDate(expectedDueDate)}, matching the invoice exactly.`,
        relatedFields: ["dueDate", "paymentTerms"],
        overpayImpact: 0,
        diffDays,
      };
    }

    const isWarning = absDiff <= DUE_DATE_WARNING_DAYS;
    return {
      rule,
      label,
      status: isWarning ? "warning" : "flagged",
      discrepancyType: DiscrepancyType.DUE_DATE_MISMATCH,
      severity: isWarning ? Severity.LOW : Severity.MEDIUM,
      expectedValue: `${fmtDate(expectedDueDate)} (${termsLabel} from receipt)`,
      actualValue: fmtDate(statedDueDate),
      explanation: `Based on the email received date (${fmtDate(receivedDate)}) and the detected ${termsLabel} terms, the expected due date is ${fmtDate(expectedDueDate)}. The invoice lists ${fmtDate(statedDueDate)}, a ${diffLabel} discrepancy.`,
      relatedFields: ["dueDate", "paymentTerms"],
      overpayImpact: 0,
      diffDays,
    };
  }

  private async checkDuplicateInvoice(
    data: ExtractedInvoiceData,
    organizationId: string,
    month: string,
    excludeInvoiceId?: string,
  ): Promise<CheckResult> {
    const rule: CheckRule = "DUPLICATE_INVOICE";
    const label = "Duplicate Invoice";

    if (!data.invoiceNumber || !data.vendorName) {
      return this.skipped(rule, label, "Missing invoice number or vendor — can't check for duplicates.");
    }

    const matches = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        month,
        invoiceNumber: { equals: data.invoiceNumber, mode: "insensitive" },
        vendorName: { equals: data.vendorName, mode: "insensitive" },
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
      },
      select: { id: true, createdAt: true },
    });

    if (matches.length > 0) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.DUPLICATE_INVOICE,
        severity: Severity.HIGH,
        expectedValue: "Unique per vendor per month",
        actualValue: `${matches.length} other invoice${matches.length > 1 ? "s" : ""} already on file this month`,
        explanation: `Invoice ${data.invoiceNumber} from ${data.vendorName} already appears ${matches.length} time${matches.length > 1 ? "s" : ""} this month — check it isn't being paid twice.`,
        relatedFields: ["invoiceNumber", "vendorName"],
        overpayImpact: data.amount ?? 0,
      };
    }

    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: "Unique per vendor per month",
      actualValue: "No matches found",
      explanation: `No other invoice numbered ${data.invoiceNumber} from ${data.vendorName} exists this month.`,
      relatedFields: ["invoiceNumber", "vendorName"],
      overpayImpact: 0,
    };
  }

  private checkMissingFields(data: ExtractedInvoiceData): CheckResult {
    const rule: CheckRule = "MISSING_FIELDS";
    const label = "Missing Fields";

    const missing = REQUIRED_FIELDS.filter((field) => {
      const value = data[field as keyof ExtractedInvoiceData];
      return value === null || value === undefined || value === "";
    });

    if (missing.length > 0) {
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.MISSING_REQUIRED_FIELD,
        severity: Severity.MEDIUM,
        expectedValue: "All required fields present",
        actualValue: `Missing: ${missing.join(", ")}`,
        explanation: `The AI couldn't find ${missing.length > 1 ? "these fields" : "this field"} anywhere on the document: ${missing.join(", ")}. Double-check the original invoice.`,
        relatedFields: missing,
        overpayImpact: 0,
      };
    }

    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: "All required fields present",
      actualValue: "All required fields present",
      explanation: "Every required field was found on the document.",
      relatedFields: [],
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
