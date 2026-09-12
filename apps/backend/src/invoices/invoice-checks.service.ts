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
  billRate: number | null;
  country: string;
  weekStart: Date | null;
  weekEnd: Date | null;
}

// Invoices rarely spell a name/vendor identically to the roster (legal name vs. first name,
// "PF Digital" vs "PF Digital P Ltd"). Token-set containment handles that without matching on
// a bare substring — "sam" won't accidentally match "samantha" the way naive .includes() would,
// since each is compared as a whole word.
function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function nameTokens(value: string): Set<string> {
  return new Set(normalizeForMatch(value).split(" ").filter(Boolean));
}

function firstNameToken(value: string): string | null {
  return normalizeForMatch(value).split(" ").filter(Boolean)[0] ?? null;
}

function lastNameToken(value: string): string | null {
  const tokens = normalizeForMatch(value).split(" ").filter(Boolean);
  return tokens.length > 1 ? tokens[tokens.length - 1] : null;
}

function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Bounded surname similarity — normalized Levenshtein distance <= 0.5, calibrated against real
// cases: "Khalendar" vs "Khandekar" (same person, inconsistent spelling) sits at 0.44 and should
// bridge; "Babu" vs "Padavala" (a different surname entirely) sits at 0.88 and must not. A floor
// of 3 chars keeps short fragments from matching almost anything.
function surnameCloseEnough(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false;
  return editDistance(a, b) / Math.max(a.length, b.length) <= 0.5;
}

function tokensSubsetMatch(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of smaller) {
    if (!larger.has(t)) return false;
  }
  return true;
}

// Catches spacing/concatenation variants token matching misses — e.g. invoice "Anji Reddy V"
// vs roster "Anjireddy Vempati" — same person, but "Anji"+"Reddy" as separate tokens never
// equals the roster's single concatenated "Anjireddy" token. Comparing with spaces stripped
// entirely, and requiring one to be a prefix of the other, catches "first name + last initial"
// abbreviation and inconsistent spacing without the false-positive risk of a bare substring
// check — the 6-char floor keeps short/weak fragments ("jo" inside "john") from matching.
function despacedPrefixMatch(a: string, b: string): boolean {
  const da = normalizeForMatch(a).replace(/\s+/g, "");
  const db = normalizeForMatch(b).replace(/\s+/g, "");
  if (da.length < 6 || db.length < 6) return false;
  return da.startsWith(db) || db.startsWith(da);
}

// Invoice numbers get re-typed/re-OCR'd slightly differently across uploads even for the
// exact same invoice — a hyphen, a leading "#", a space — so comparing raw strings misses
// real duplicates. Keeping only letters/digits is precise enough to still tell genuinely
// different numbers apart (INV-000192 stays different from INV-000193).
function normalizeInvoiceNumber(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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
    // Some staffing invoices bill more than one consultant as separate line items. A single
    // top-level consultantName/hours/hourlyRate can't represent that, so when the line items
    // name more than one distinct person, check each of them against the roster individually
    // instead of running one check against a blank/ambiguous top-level consultant.
    const distinctConsultants = Array.from(
      new Set((data.lineItems ?? []).map((li) => li.consultantName).filter((n): n is string => !!n)),
    );

    const perConsultantChecks: CheckResult[] = [];
    if (distinctConsultants.length > 1) {
      for (const name of distinctConsultants) {
        const line = (data.lineItems ?? []).find((li) => li.consultantName === name)!;
        const lineData: ExtractedInvoiceData = { ...data, consultantName: name, hours: line.hours, hourlyRate: line.hourlyRate };
        const roster = await this.findRosterMatch(lineData, organizationId, month);
        perConsultantChecks.push(this.checkApprovedHours(lineData, roster, name));
        perConsultantChecks.push(this.checkBillingRate(lineData, roster, name));
        perConsultantChecks.push(this.checkHolidayHours(lineData, roster, name));
      }
    } else {
      const roster = await this.findRosterMatch(data, organizationId, month);
      perConsultantChecks.push(this.checkApprovedHours(data, roster));
      perConsultantChecks.push(this.checkBillingRate(data, roster));
      perConsultantChecks.push(this.checkHolidayHours(data, roster));
    }

    return [
      ...perConsultantChecks,
      this.checkSubmissionDate(data, receivedDate),
      this.checkDueDate(data, receivedDate),
      await this.checkDuplicateInvoice(data, organizationId, month, excludeInvoiceId),
      this.checkMissingFields(data, distinctConsultants.length > 1),
    ];
  }

  private async findRosterMatch(
    data: ExtractedInvoiceData,
    organizationId: string,
    month: string,
  ): Promise<RosterMatch | null> {
    if (!data.consultantName) return null;

    // Pulled unfiltered and matched in JS — invoices rarely spell a name/vendor identically to
    // the roster ("Sagar Kumar Mishra" vs "Sagar", "PF Digital P Ltd" vs "PF Digital"), so an
    // exact-equals WHERE clause misses real matches. A roster for one org/month is small enough
    // that scoring every row here costs nothing meaningful.
    const allForMonth = await this.prisma.timesheet.findMany({
      where: { organizationId, month },
      orderBy: { workDate: "desc" },
    });
    if (allForMonth.length === 0) return null;

    const invoiceVendorTokens = data.vendorName ? nameTokens(data.vendorName) : null;

    const invoiceNameTokens = nameTokens(data.consultantName);
    let nameMatches = allForMonth.filter((c) => tokensSubsetMatch(invoiceNameTokens, nameTokens(c.employeeName)));
    if (nameMatches.length === 0) {
      nameMatches = allForMonth.filter((c) => despacedPrefixMatch(data.consultantName!, c.employeeName));
    }
    if (nameMatches.length === 0 && data.hourlyRate !== null) {
      // Neither tier above bridges a genuine surname spelling mismatch ("Khalendar" vs
      // "Khandekar") — that needs an explicit fuzzy check on the surname itself, not just a
      // vendor/rate coincidence (most real rosters don't even capture a vendor/agency column,
      // so gating on vendor here would never fire). Require exact first name + exact pay rate as
      // strong corroborating signals, AND a bounded edit-distance on the surname specifically —
      // this bridges "Khalendar"/"Khandekar" (0.44 normalized distance) while still correctly
      // rejecting a genuinely different surname like "Babu" vs "Padavala" (0.88), which a looser
      // "unique first name + rate" rule alone would not have caught.
      const invoiceFirst = firstNameToken(data.consultantName);
      const invoiceLast = lastNameToken(data.consultantName);
      if (invoiceFirst && invoiceLast) {
        nameMatches = allForMonth.filter((c) => {
          const rosterLast = lastNameToken(c.employeeName);
          return (
            firstNameToken(c.employeeName) === invoiceFirst &&
            rosterLast &&
            surnameCloseEnough(invoiceLast, rosterLast) &&
            Number(c.hourlyRate) === data.hourlyRate
          );
        });
      }
    }
    if (nameMatches.length === 0) return null;

    // A bare first-name match alone isn't confident enough once two different vendors could
    // share a first name on the roster — prefer rows whose vendor also lines up, and only fall
    // back to name-only matches when no vendor confirmation is possible on either side.
    const vendorConfirmed = invoiceVendorTokens
      ? nameMatches.filter((c) => c.vendor && tokensSubsetMatch(invoiceVendorTokens, nameTokens(c.vendor)))
      : [];
    const candidates = vendorConfirmed.length > 0 ? vendorConfirmed : nameMatches;

    function toMatch(row: (typeof candidates)[number]): RosterMatch {
      return {
        employeeName: row.employeeName,
        hours: Number(row.hours),
        hourlyRate: Number(row.hourlyRate),
        billRate: row.billRate !== null ? Number(row.billRate) : null,
        country: row.country,
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
      };
    }

    // Prefer a roster row whose week overlaps the invoice's billing period, if we have one
    if (data.periodStart && data.periodEnd) {
      const periodStart = new Date(data.periodStart);
      const periodEnd = new Date(data.periodEnd);
      const overlapping = candidates.find(
        (c) => c.weekStart && c.weekEnd && c.weekStart <= periodEnd && c.weekEnd >= periodStart,
      );
      if (overlapping) return toMatch(overlapping);
    }

    return toMatch(candidates[0]);
  }

  private checkApprovedHours(data: ExtractedInvoiceData, roster: RosterMatch | null, labelSuffix?: string): CheckResult {
    const rule: CheckRule = "APPROVED_HOURS";
    const label = labelSuffix ? `Approved Hours — ${labelSuffix}` : "Approved Hours";

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

  private checkBillingRate(data: ExtractedInvoiceData, roster: RosterMatch | null, labelSuffix?: string): CheckResult {
    const rule: CheckRule = "BILLING_RATE";
    const label = labelSuffix ? `Billing Rate — ${labelSuffix}` : "Billing Rate";

    if (data.hourlyRate === null) {
      return this.skipped(rule, label, "No hourly rate stated on this invoice.");
    }
    if (!roster) {
      return this.skipped(rule, label, "No roster entry to verify the contracted rate against.");
    }

    // Every invoice Audix processes is a vendor billing us — so it should be checked against
    // OUR pay rate to that vendor (what we contracted to pay them), not our bill rate to our
    // own end client. Bill rate is a downstream number for a transaction the vendor is never
    // party to (what we in turn charge our client) — comparing a vendor invoice against it
    // would flag correct invoices and clear incorrect ones, exactly backwards. billRate stays
    // on the roster row for reference/margin purposes, it's just not what this check verifies.
    const expectedRate = roster.hourlyRate;

    if (expectedRate !== data.hourlyRate) {
      const expectedAmount = roster.hours * expectedRate;
      const direction = data.hourlyRate < expectedRate ? "under" : "over";
      return {
        rule,
        label,
        status: "flagged",
        discrepancyType: DiscrepancyType.RATE_MISMATCH,
        severity: Severity.HIGH,
        expectedValue: `$${expectedRate}/hr (expected total $${expectedAmount.toFixed(2)})`,
        actualValue: `$${data.hourlyRate}/hr`,
        explanation: `The invoice bills at $${data.hourlyRate}/hr, but the approved pay rate for ${roster.employeeName} is $${expectedRate}/hr — ${direction}billed by $${Math.abs(data.hourlyRate - expectedRate).toFixed(2)}/hr.`,
        relatedFields: ["hourlyRate", "amount"],
        overpayImpact: Math.max(0, data.hourlyRate - expectedRate) * roster.hours,
      };
    }
    return {
      rule,
      label,
      status: "passed",
      discrepancyType: null,
      severity: null,
      expectedValue: `$${expectedRate}/hr`,
      actualValue: `$${data.hourlyRate}/hr`,
      explanation: `Billing rate matches the approved pay rate ($${data.hourlyRate}/hr).`,
      relatedFields: ["hourlyRate"],
      overpayImpact: 0,
    };
  }

  private checkHolidayHours(data: ExtractedInvoiceData, roster: RosterMatch | null, labelSuffix?: string): CheckResult {
    const rule: CheckRule = "HOLIDAY_HOURS";
    const label = labelSuffix ? `Holiday Hours — ${labelSuffix}` : "Holiday Hours";

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
        "No payment term found on the invoice — enter it manually to validate the due date.",
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
        explanation: `Based on the email received date (${fmtDate(receivedDate)}) and the ${termsLabel} payment term, the expected due date is ${fmtDate(expectedDueDate)}, matching the invoice exactly.`,
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
      explanation: `Based on the email received date (${fmtDate(receivedDate)}) and the ${termsLabel} payment term, the expected due date is ${fmtDate(expectedDueDate)}. The invoice lists ${fmtDate(statedDueDate)}, a ${diffLabel} discrepancy.`,
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

    // Pulled for the month and matched in JS, same reasoning as roster name matching: an
    // exact-string WHERE clause misses real duplicates whenever the AI transcribes the same
    // vendor slightly differently across two uploads ("PF Digital" vs "PF Digital P Ltd") or
    // the invoice number picks up stray formatting ("INV-000192" vs "INV000192").
    const candidates = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        month,
        ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
      },
      select: { id: true, invoiceNumber: true, vendorName: true, createdAt: true },
    });

    const invoiceNumberKey = normalizeInvoiceNumber(data.invoiceNumber);
    const invoiceVendorTokens = nameTokens(data.vendorName);
    const matches = candidates.filter(
      (c) =>
        normalizeInvoiceNumber(c.invoiceNumber) === invoiceNumberKey &&
        tokensSubsetMatch(invoiceVendorTokens, nameTokens(c.vendorName)),
    );

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

  private checkMissingFields(data: ExtractedInvoiceData, isMultiConsultant: boolean): CheckResult {
    const rule: CheckRule = "MISSING_FIELDS";
    const label = "Missing Fields";

    // On a genuine multi-consultant invoice there is no single top-level hours/rate by design —
    // each consultant's real hours/rate live on their own line item and are already checked
    // individually above. Flagging them "missing" here would be a false alarm, not a real gap.
    const requiredFields = isMultiConsultant
      ? REQUIRED_FIELDS.filter((f) => f !== "hours" && f !== "hourlyRate")
      : REQUIRED_FIELDS;

    const missing = requiredFields.filter((field) => {
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
