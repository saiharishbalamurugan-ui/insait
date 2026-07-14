export type RiskLabel = "Approved" | "Flagged" | "High Risk";
export type InvoiceStatus = "PENDING" | "PROCESSING" | "AUDITED" | "FAILED";

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
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
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
  lineItems: InvoiceLineItem[];
  matchedTimesheet: MatchedTimesheet | null;
  latestReport: AuditReport | null;
}

export interface DashboardStats {
  total: number;
  totalValue: number;
  approved: number;
  flagged: number;
  highRisk: number;
  savings: number;
  monthlyVolume: { label: string; value: number }[];
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
  fileUrl: string;
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
  fileUrl: string | null;
  extractedData: unknown;
}
