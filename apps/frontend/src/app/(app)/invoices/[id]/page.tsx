"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { useInvoice, useDeleteInvoice } from "@/lib/hooks/use-invoice";
import { initials, initialsColor, fmtDate, fmtMonthLabel } from "@/lib/format";
import { StatusBadge, invoiceDisplayStatus } from "@/components/invoices/status-badge";
import { AuditFlow } from "@/components/audit/audit-flow";
import { useMonthContext } from "@/lib/hooks/use-month";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useSession } from "@/lib/hooks/use-session";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: invoice } = useInvoice(id);
  const { selectedMonth, currentMonthLabel } = useMonthContext();
  // Gate on the invoice's OWN month, not the list page's month-selector filter — this page
  // can be reached directly by id (e.g. from Reports) while the selector still shows a
  // different month, so "isViewingCurrent" from context would be the wrong signal here.
  const isCurrentMonthInvoice = currentMonthLabel !== null && invoice?.month === currentMonthLabel;
  const deleteInvoice = useDeleteInvoice();
  const { data: session } = useSession();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirmDelete() {
    if (!session?.user) return;
    deleteInvoice.mutate(
      { id, actorName: session.user.name, actorUserId: session.user.id },
      {
        onSuccess: () => {
          toast.success("Invoice deleted");
          router.push("/invoices");
        },
      },
    );
  }

  return (
    <>
      <Topbar />
      <PageContent>
        <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground mb-3.5">
          <Link href="/invoices" className="hover:text-primary">
            Invoices{selectedMonth ? ` · ${fmtMonthLabel(selectedMonth)}` : ""}
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
            <div className="flex items-center gap-2">
              <StatusBadge status={invoiceDisplayStatus(invoice.status, invoice.riskLabel)} />
              {isCurrentMonthInvoice && (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" size="icon" className="size-8" aria-label="Invoice actions">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                      <Trash2 className="size-3.5" /> Delete Invoice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}

        <AuditFlow invoiceId={id} />
      </PageContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this invoice?"
        description={`This permanently removes ${invoice?.invoiceNumber ?? "this invoice"} and its audit history. This can't be undone.`}
        confirmLabel="Delete Invoice"
        destructive
        isPending={deleteInvoice.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
