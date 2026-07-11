"use client";

import Link from "next/link";
import { ClipboardList, Download } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useReports } from "@/lib/hooks/use-reports";
import { apiClient } from "@/lib/api-client";
import { InvoiceDetail } from "@/lib/types";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/invoices/status-badge";
import { downloadAuditReportPDF } from "@/lib/pdf";
import { ReportItem } from "@/lib/types";

export default function ReportsPage() {
  const { data: reports, isLoading } = useReports();

  return (
    <>
      <Topbar />
      <PageContent>
        <div className="font-display font-semibold text-[15.5px] mb-0.5">Audit Reports</div>
        <div className="text-[12.5px] text-muted-foreground mb-4">
          Generated automatically for every flagged or high-risk invoice.
        </div>

        {isLoading && (
          <div className="space-y-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[130px] rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && (reports ?? []).length === 0 && (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              <ClipboardList className="size-9 mx-auto mb-3 text-text-faint" />
              No audit reports yet — every invoice matches QuickBooks.
            </CardContent>
          </Card>
        )}

        <div className="space-y-3.5">
          {(reports ?? []).map((r) => (
            <ReportCard key={r.reportId} item={r} />
          ))}
        </div>
      </PageContent>
    </>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  async function handleDownload() {
    try {
      const invoice = await apiClient.get<InvoiceDetail>(`/invoices/${item.invoiceId}`);
      downloadAuditReportPDF(invoice);
    } catch {
      toast.error("Couldn't load invoice data for the PDF — try again.");
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex justify-between items-start gap-3.5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-[14px]">{item.invoiceNumber}</span>
              <StatusBadge status={item.riskLabel} />
              {item.reviewAction && (
                <span className="text-[11px] font-semibold text-primary">
                  {item.reviewAction === "APPROVED"
                    ? "Approved for Payment"
                    : item.reviewAction === "REJECTED"
                      ? "Rejected"
                      : "Awaiting Vendor"}
                </span>
              )}
            </div>
            <div className="font-semibold mt-1.5">
              {item.findings[0]?.discrepancyType.replace(/_/g, " ") ?? "Discrepancy detected"}
            </div>
            <div className="text-muted-foreground text-[12.5px] mt-1 max-w-[640px]">
              {item.consultantName} · {item.vendorName} · {item.project}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-bold text-text-faint">EST. OVERPAYMENT</div>
            <div className="font-mono text-[19px] font-bold text-danger">{money(item.overpay)}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3.5">
          <Link href={`/invoices/${item.invoiceId}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            View Full Report
          </Link>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={handleDownload}>
            <Download className="size-3.5" /> Download PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
