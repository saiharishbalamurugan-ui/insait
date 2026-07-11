"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { useInvoice } from "@/lib/hooks/use-invoice";
import { initials, initialsColor, fmtDate } from "@/lib/format";
import { StatusBadge, invoiceDisplayStatus } from "@/components/invoices/status-badge";
import { AuditFlow } from "@/components/audit/audit-flow";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: invoice } = useInvoice(id);

  return (
    <>
      <Topbar />
      <PageContent>
        <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground mb-3.5">
          <Link href="/inbox" className="hover:text-primary">
            Email Inbox
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-text-faint">{invoice?.invoiceNumber ?? "…"}</span>
        </div>

        {invoice && (
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3.5">
              <div
                className="size-[46px] rounded-[9px] flex items-center justify-center text-white text-[15px] font-bold shrink-0"
                style={{ background: initialsColor(invoice.vendorName) }}
              >
                {initials(invoice.vendorName)}
              </div>
              <div>
                <div className="font-display font-bold text-[19px]">
                  {invoice.invoiceNumber} — {invoice.vendorName}
                </div>
                <div className="text-[12.5px] text-text-faint">
                  {invoice.consultantName} · Received {fmtDate(invoice.issueDate)}
                </div>
              </div>
            </div>
            <StatusBadge status={invoiceDisplayStatus(invoice.status, invoice.riskLabel)} />
          </div>
        )}

        <AuditFlow invoiceId={id} />
      </PageContent>
    </>
  );
}
