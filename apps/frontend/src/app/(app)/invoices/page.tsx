"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UploadCloud, Trash2, Lock, Files } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovalCounts, useInvoices } from "@/lib/hooks/use-invoices";
import { useBulkDeleteInvoices } from "@/lib/hooks/use-invoice";
import { useMonthContext } from "@/lib/hooks/use-month";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { money, fmtDateShort, initials, initialsColor, timeAgo } from "@/lib/format";
import { StatusBadge, ApprovalBadge, invoiceDisplayStatus } from "@/components/invoices/status-badge";
import { ApprovalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const APPROVAL_TABS: { key: ApprovalStatus; label: string; countKey: "pendingApproval" | "approved" | "rejected" }[] = [
  { key: "PENDING_APPROVAL", label: "Pending Approval", countKey: "pendingApproval" },
  { key: "APPROVED", label: "Approved", countKey: "approved" },
  { key: "REJECTED", label: "Rejected", countKey: "rejected" },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ApprovalStatus>("PENDING_APPROVAL");
  const [search, setSearch] = useState("");
  const { data: invoices, isLoading } = useInvoices({ approvalStatus: tab, search });
  const { data: counts } = useApprovalCounts();
  const { isViewingCurrent } = useMonthContext();
  const bulkDelete = useBulkDeleteInvoices();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const list = invoices ?? [];
  const allSelected = list.length > 0 && selected.size === list.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(list.map((i) => i.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <>
      <Topbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search invoices, vendors, consultants..." />
      <PageContent>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {APPROVAL_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setSelected(new Set());
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-colors whitespace-nowrap",
                  tab === t.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "text-[11px] font-mono px-1.5 py-0.5 rounded-full",
                    tab === t.key ? "bg-background/15" : "bg-secondary",
                  )}
                >
                  {counts ? counts[t.countKey] : "—"}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selected.size > 0 ? (
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="size-3.5" />
                Delete {selected.size} Selected
              </Button>
            ) : (
              <div className="text-[12.5px] text-text-faint">{list.length} invoices</div>
            )}
            {isViewingCurrent ? (
              <>
                <Link
                  href="/invoices/bulk-upload"
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
                >
                  <Files className="size-3.5" />
                  Bulk Upload
                </Link>
                <Link href="/invoices/upload" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                  <UploadCloud className="size-3.5" />
                  Upload Invoice
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-[12px] text-text-faint px-2">
                <Lock className="size-3.5" /> Read-only history
              </div>
            )}
          </div>
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
                  {isViewingCurrent && (
                    <TableHead className="w-8">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} onClick={(e) => e.stopPropagation()} />
                    </TableHead>
                  )}
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="text-center py-12 text-muted-foreground">
                        <Search className="size-8 mx-auto mb-3 text-text-faint" />
                        No invoices in this tab.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {list.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/invoices/${inv.id}?from=${tab}`)}
                  >
                    {isViewingCurrent && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleOne(inv.id)} />
                      </TableCell>
                    )}
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
                    <TableCell>
                      <ApprovalBadge status={inv.approvalStatus} />
                    </TableCell>
                    <TableCell className="text-text-faint">{timeAgo(inv.issueDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${selected.size} invoice${selected.size === 1 ? "" : "s"}?`}
        description="This permanently deletes the selected invoices and their audit reports. This cannot be undone."
        confirmLabel="Delete Selected"
        destructive
        isPending={bulkDelete.isPending}
        onConfirm={() =>
          bulkDelete.mutate(Array.from(selected), {
            onSuccess: (result) => {
              toast.success(`Deleted ${result.deleted} invoice${result.deleted === 1 ? "" : "s"}.`);
              setSelected(new Set());
              setConfirmOpen(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete those invoices."),
          })
        }
      />
    </>
  );
}
