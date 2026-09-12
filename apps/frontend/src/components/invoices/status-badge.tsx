import { cn } from "@/lib/utils";
import { Loader2, Check, X, Clock } from "lucide-react";
import { InvoiceStatus, RiskLabel, ApprovalStatus } from "@/lib/types";

const STYLES: Record<string, string> = {
  Approved: "bg-success-soft text-success",
  Flagged: "bg-warning-soft text-warning",
  "High Risk": "bg-danger-soft text-danger",
  Processing: "bg-indigo-soft text-indigo",
};

const DOT: Record<string, string> = {
  Approved: "bg-success",
  Flagged: "bg-warning",
  "High Risk": "bg-danger",
  Processing: "bg-indigo animate-pulse",
};

export function StatusBadge({ status }: { status: RiskLabel | "Processing" | "Pending" }) {
  const label = status === "Pending" ? "Processing" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap",
        STYLES[label] ?? STYLES.Approved,
      )}
    >
      {label === "Processing" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className={cn("size-1.5 rounded-full", DOT[label])} />
      )}
      {label}
    </span>
  );
}

export function invoiceDisplayStatus(status: InvoiceStatus, riskLabel: RiskLabel | null): RiskLabel | "Processing" {
  if (status === "PENDING" || status === "PROCESSING") return "Processing";
  return riskLabel ?? "Approved";
}

// The human approve/reject decision — deliberately a distinct visual (icon + shape) from
// StatusBadge above so the two never get confused, since StatusBadge's AI risk label also
// uses the word "Approved" for a completely different thing (a clean risk score).
const APPROVAL_STYLES: Record<ApprovalStatus, string> = {
  APPROVED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
  PENDING_APPROVAL: "bg-secondary text-muted-foreground",
};

const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PENDING_APPROVAL: "Pending Approval",
};

const APPROVAL_ICONS: Record<ApprovalStatus, typeof Check> = {
  APPROVED: Check,
  REJECTED: X,
  PENDING_APPROVAL: Clock,
};

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const Icon = APPROVAL_ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap",
        APPROVAL_STYLES[status],
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {APPROVAL_LABELS[status]}
    </span>
  );
}
