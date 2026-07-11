"use client";

import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvoices } from "@/lib/hooks/use-invoices";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/invoices/status-badge";

export default function AuditPage() {
  const router = useRouter();
  const { data: invoices, isLoading } = useInvoices();

  const audited = (invoices ?? []).filter((i) => i.status === "AUDITED");
  const queue = audited
    .filter((i) => i.riskLabel !== "Approved")
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

  const totalAtRisk = queue.reduce((s, i) => s + i.overpay, 0);
  const avgConfidence = audited.length
    ? audited.reduce((s, i) => s + (i.confidence ?? 0), 0) / audited.length
    : 0;

  return (
    <>
      <Topbar />
      <PageContent>
        <Card className="mb-[18px]">
          <CardContent className="p-5 flex gap-8 flex-wrap">
            <Stat label="Invoices Audited" value={String(audited.length)} />
            <Stat label="Discrepancies Found" value={String(queue.length)} color="text-warning" />
            <Stat label="Avg. Match Confidence" value={`${avgConfidence.toFixed(1)}%`} color="text-primary" />
            <Stat label="Total at Risk" value={money(totalAtRisk)} color="text-danger" />
          </CardContent>
        </Card>

        <Card>
          <div className="p-5 pb-3.5 border-b border-border">
            <div className="font-display font-semibold text-[15.5px]">AI Audit Queue</div>
            <div className="text-[12.5px] text-muted-foreground">
              Invoices where the audit engine detected a mismatch against QuickBooks-approved timesheets.
            </div>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Est. Overpayment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="text-center py-12 text-muted-foreground">
                        No discrepancies — every audited invoice matches QuickBooks.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {queue.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                    <TableCell className="font-mono font-semibold">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.consultantName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-[60px] h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${inv.riskScore ?? 0}%`,
                              background: (inv.riskScore ?? 0) >= 75 ? "var(--danger)" : "var(--warning)",
                            }}
                          />
                        </div>
                        <span className="font-mono text-[12px]">{inv.riskScore}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{money(inv.overpay)}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.riskLabel ?? "Approved"} />
                    </TableCell>
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-text-faint text-[12px] font-semibold">{label}</div>
      <div className={`font-display text-[22px] font-bold ${color ?? ""}`}>{value}</div>
    </div>
  );
}
