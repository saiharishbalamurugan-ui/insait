"use client";

// TODO(email-automation): Vendor invoices inbox — invoices arrive automatically from
// connected vendor mailbox and are queued for AI review. Gated behind
// FEATURES.emailInbox until that mailbox-connection automation is actually built;
// this page and its nav entry are otherwise complete and ready to re-enable.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Paperclip } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { useInvoices } from "@/lib/hooks/use-invoices";
import { initials, initialsColor, timeAgo } from "@/lib/format";
import { StatusBadge, invoiceDisplayStatus } from "@/components/invoices/status-badge";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/feature-flags";

export default function InboxPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data: invoices } = useInvoices({ search });

  useEffect(() => {
    if (!FEATURES.emailInbox) router.replace("/invoices");
  }, [router]);

  if (!FEATURES.emailInbox) {
    return (
      <>
        <Topbar />
        <PageContent>
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">Redirecting…</CardContent>
          </Card>
        </PageContent>
      </>
    );
  }

  const list = (invoices ?? []).filter((i) => i.source === "EMAIL_INGESTION");

  return (
    <>
      <Topbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search inbox..." />
      <PageContent>
        <Card>
          <div className="p-5 pb-3.5 border-b border-border">
            <div className="font-display font-semibold text-[15.5px]">Vendor Invoice Inbox</div>
            <div className="text-[12.5px] text-muted-foreground">
              Invoices arrive automatically from connected vendor mailboxes and are queued for AI review.
            </div>
          </div>

          {list.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Mail className="size-9 mx-auto mb-3 text-text-faint" />
              No emails match your search.
            </div>
          )}

          <div>
            {list.map((inv) => (
              <div
                key={inv.id}
                onClick={() => router.push(`/invoices/${inv.id}`)}
                className={cn(
                  "flex gap-3.5 px-[18px] py-[15px] border-b border-border last:border-b-0 cursor-pointer hover:bg-secondary transition-colors items-start",
                )}
              >
                <div
                  className="size-[38px] rounded-[9px] shrink-0 flex items-center justify-center font-bold text-[13px] text-white"
                  style={{ background: initialsColor(inv.vendorName) }}
                >
                  {initials(inv.vendorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2.5">
                    <div className="font-semibold text-[13.5px]">{inv.vendorName}</div>
                    <div className="text-[11.5px] text-text-faint shrink-0">{timeAgo(inv.issueDate)}</div>
                  </div>
                  <div className={cn("text-[13px] mt-0.5", inv.status === "PENDING" && "font-bold")}>
                    Invoice {inv.invoiceNumber} — {inv.project}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 truncate">
                    Please find attached invoice {inv.invoiceNumber} for {inv.consultantName} covering the billing
                    period referenced above. Remit payment per standard net-15 terms...
                  </div>
                  <div className="flex items-center gap-2 mt-[7px]">
                    <div className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground bg-secondary px-2.5 py-[3px] rounded-md">
                      <Paperclip className="size-3" />
                      invoice_{inv.invoiceNumber.replace("INV-", "")}.pdf
                    </div>
                    <StatusBadge status={invoiceDisplayStatus(inv.status, inv.riskLabel)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </PageContent>
    </>
  );
}
