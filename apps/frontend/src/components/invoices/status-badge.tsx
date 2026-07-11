import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { InvoiceStatus, RiskLabel } from "@/lib/types";

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
