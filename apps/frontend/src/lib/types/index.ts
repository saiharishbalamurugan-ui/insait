export type RiskLabel = "Approved" | "Flagged" | "High Risk";
export type InvoiceStatus = "PENDING" | "PROCESSING" | "AUDITED" | "FAILED";
export type ApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  consultantName: string | null;
  project: string | null;
  managerName: string | null;
  amount: number;
  hours: number | null;
  hourlyRate: number | null;
  issueDate: string;
  status: InvoiceStatus;
  riskScore: number | null;
  riskLabel: RiskLabel | null;
  confidence: number | null;
  overpay: number;
  source: "MANUAL_UPLOAD" | "EMAIL_INGESTION";
  month: string;
  approvalStatus: ApprovalStatus;
}

export interface InvoiceLineItem {
  id: string;
  consultantName: string | null;
  description: string;
  quantity: number | null;
  rate: number | null;
  amount: number;
}

export interface MatchedTimesheet {
  id: string;
  employeeName: string;
  hours: number;
  hourlyRate: number;
  project: string | null;
  managerName: string | null;
  workDate: string;
}

export type DiscrepancyType =
  | "OVERBILLING"
  | "DUPLICATE_CHARGE"
  | "RATE_MISMATCH"
  | "HOURS_MISMATCH"
  | "MISSING_TIMESHEET"
  | "UNAUTHORIZED_VENDOR"
  | "DATE_MISMATCH"
  | "TAX_ERROR"
  | "HOLIDAY_OVERBILLING"
  | "DUE_DATE_MISMATCH"
  | "DUPLICATE_INVOICE"
  | "MISSING_REQUIRED_FIELD"
  | "OTHER";

export interface AuditFinding {
  id: string;
  discrepancyType: DiscrepancyType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  explanation: string;
  expectedValue: string | null;
  actualValue: string | null;
}

export interface AuditReport {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  overallRiskScore: number | null;
  summary: string | null;
  reviewAction: "APPROVED" | "REJECTED" | "CLARIFICATION_REQUESTED" | null;
  reviewedAt: string | null;
  completedAt: string | null;
  findings: AuditFinding[];
}

export interface InvoiceDetail extends InvoiceListItem {
  fileUrl: string | null;
  extractedFieldPositions: FieldPosition[] | null;
  lineItems: InvoiceLineItem[];
  matchedTimesheet: MatchedTimesheet | null;
  latestReport: AuditReport | null;
  checks: CheckResult[] | null;
}

export interface DashboardStats {
  total: number;
  totalValue: number;
  approved: number;
  flagged: number;
  highRisk: number;
  savings: number;
  pendingApproval: number;
  rejected: number;
  lowRisk: number;
  monthlyVolume: { label: string; value: number }[];
}

export interface ApprovalCounts {
  pendingApproval: number;
  approved: number;
  rejected: number;
}

export interface TimesheetItem {
  id: string;
  employeeName: string;
  project: string | null;
  managerName: string | null;
  hours: number;
  hourlyRate: number;
  approvedValue: number;
  workDate: string;
  matchedInvoice: { id: string; invoiceNumber: string; status: InvoiceStatus } | null;
}

export interface ReportItem {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  consultantName: string | null;
  project: string | null;
  issueDate: string;
  riskLabel: RiskLabel;
  overpay: number;
  reportId: string;
  summary: string | null;
  reviewAction: "APPROVED" | "REJECTED" | "CLARIFICATION_REQUESTED" | null;
  findings: { discrepancyType: DiscrepancyType; severity: string; explanation: string }[];
}

export type ExtractableField =
  | "vendorName"
  | "invoiceNumber"
  | "consultantName"
  | "project"
  | "hours"
  | "hourlyRate"
  | "amount"
  | "issueDate"
  | "dueDate"
  | "periodStart"
  | "periodEnd"
  | "paymentTerms";

export interface FieldPosition {
  field: ExtractableField;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CheckRule =
  | "APPROVED_HOURS"
  | "BILLING_RATE"
  | "HOLIDAY_HOURS"
  | "SUBMISSION_DATE"
  | "DUE_DATE"
  | "DUPLICATE_INVOICE"
  | "MISSING_FIELDS";

export type CheckStatus = "passed" | "warning" | "flagged" | "skipped";

export interface CheckResult {
  rule: CheckRule;
  label: string;
  status: CheckStatus;
  discrepancyType: DiscrepancyType | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  expectedValue: string | null;
  actualValue: string | null;
  explanation: string;
  relatedFields: ExtractableField[];
  overpayImpact: number;
  diffDays?: number | null;
}

export interface ExtractedLineItem {
  consultantName: string | null;
  description: string;
  hours: number | null;
  hourlyRate: number | null;
  amount: number;
}

export interface ExtractedInvoiceData {
  vendorName: string;
  invoiceNumber: string;
  consultantName: string | null;
  project: string | null;
  hours: number | null;
  hourlyRate: number | null;
  amount: number | null;
  issueDate: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paymentTermsLabel: string | null;
  paymentTermsDays: number | null;
  lineItems?: ExtractedLineItem[];
  fieldPositions: FieldPosition[];
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
  receivedDate: string;
  checks: CheckResult[];
}

export interface CreateInvoicePayload {
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
}

export interface RosterEntry {
  id: string;
  employeeName: string;
  hours: number;
  hourlyRate: number;
  billRate: number | null;
  country: string;
  weekStart: string | null;
  weekEnd: string | null;
  project: string | null;
  managerName: string | null;
  updatedAt: string;
  month: string;
}

export interface Month {
  id: string;
  organizationId: string;
  label: string; // "YYYY-MM"
  isCurrent: boolean;
  createdAt: string;
}
