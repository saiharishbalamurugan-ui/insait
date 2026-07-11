"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoices } from "@/lib/hooks/use-invoices";
import { money, fmtDateShort, initials, initialsColor, timeAgo } from "@/lib/format";
import { StatusBadge, invoiceDisplayStatus } from "@/components/invoices/status-badge";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "Approved", label: "Approved" },
  { key: "Flagged", label: "Flagged" },
  { key: "High Risk", label: "High Risk" },
] as const;

export default function InvoicesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { data: invoices, isLoading } = useInvoices({ status: filter !== "all" ? filter : undefined, search });

  return (
    <>
      <Topbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search invoices, vendors, consultants..." />
      <PageContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-colors",
                  filter === f.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="text-[12.5px] text-text-faint">{invoices?.length ?? 0} invoices</div>
        </div>

        <Card>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoices ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <div className="text-center py-12 text-muted-foreground">
                        <Search className="size-8 mx-auto mb-3 text-text-faint" />
                        No invoices match your search.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {(invoices ?? []).map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <TableCell>
                      <span className="font-mono font-semibold">{inv.invoiceNumber}</span>
                      {inv.status === "PROCESSING" && (
                        <div className="mt-1">
                          <StatusBadge status="Processing" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="size-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ background: initialsColor(inv.consultantName ?? inv.vendorName) }}
                        >
                          {initials(inv.consultantName ?? inv.vendorName)}
                        </div>
                        <div>
                          <div className="font-semibold">{inv.consultantName}</div>
                          <div className="text-[11.5px] text-text-faint">{inv.project}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{inv.vendorName}</TableCell>
                    <TableCell className="text-text-faint">{fmtDateShort(inv.issueDate)}</TableCell>
                    <TableCell className="font-mono">{money(inv.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoiceDisplayStatus(inv.status, inv.riskLabel)} />
                    </TableCell>
                    <TableCell className="text-text-faint">{timeAgo(inv.issueDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>
    </>
  );
}
