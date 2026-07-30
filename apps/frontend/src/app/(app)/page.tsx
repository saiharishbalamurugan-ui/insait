"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Database, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/lib/hooks/use-dashboard";
import { useInvoices } from "@/lib/hooks/use-invoices";
import { money, pct, initials, initialsColor, fmtMonthLabel } from "@/lib/format";
import { StatusBadge } from "@/components/invoices/status-badge";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { useMonthContext } from "@/lib/hooks/use-month";

export default function DashboardPage() {
  const router = useRouter();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: invoices } = useInvoices();
  const { selectedMonth } = useMonthContext();
  const monthLabel = selectedMonth ? fmtMonthLabel(selectedMonth) : "the selected month";

  const needsAttention = (invoices ?? [])
    .filter((i) => i.riskLabel === "Flagged" || i.riskLabel === "High Risk")
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
    .slice(0, 5);

  const kpis = stats
    ? [
        {
          label: "Invoices Processed",
          value: String(stats.total),
          sub: `across the portfolio`,
          icon: FileText,
          color: "text-indigo",
          bg: "bg-indigo-soft",
          tooltip: `Every invoice uploaded and saved in ${monthLabel} — bulk uploads count individually.`,
        },
        {
          label: "Total Invoice Value",
          value: money(stats.totalValue),
          sub: "all invoices",
          icon: Database,
          color: "text-primary",
          bg: "bg-brand-soft",
          tooltip: `Combined dollar amount across every invoice in ${monthLabel}, regardless of status.`,
        },
        {
          label: "Approved",
          value: String(stats.approved),
          sub: stats.total ? `${pct((stats.approved / stats.total) * 100)} clean match rate` : "—",
          icon: CheckCircle2,
          color: "text-success",
          bg: "bg-success-soft",
          tooltip: `Invoices in ${monthLabel} with a risk score under 20 — no or trivial discrepancies found.`,
        },
        {
          label: "Flagged",
          value: String(stats.flagged),
          sub: "needs vendor follow-up",
          icon: AlertTriangle,
          color: "text-warning",
          bg: "bg-warning-soft",
          tooltip: `Invoices in ${monthLabel} with a risk score of 20–74 — real discrepancies worth reviewing before payment.`,
        },
        {
          label: "High Risk",
          value: String(stats.highRisk),
          sub: "hold payment recommended",
          icon: ShieldAlert,
          color: "text-danger",
          bg: "bg-danger-soft",
          tooltip: `Invoices in ${monthLabel} with a risk score of 75+ — severe or multiple discrepancies. Worth holding payment for review.`,
        },
        {
          label: "Est. Savings",
          value: money(stats.savings),
          sub: "overpayments prevented",
          icon: Sparkles,
          color: "text-primary",
          bg: "bg-brand-soft",
          tooltip: `Sum of the estimated overpayment on every Flagged and High Risk invoice in ${monthLabel} — the money these checks caught before payment went out.`,
        },
      ]
    : [];

  return (
    <>
      <Topbar />
      <PageContent>
        <div className="grid grid-cols-3 gap-[18px] mb-[18px]">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[110px] rounded-xl" />)
            : kpis.map((k) => (
                <Card key={k.label}>
                  <CardContent className="p-[20px_22px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-muted-foreground text-[12px] font-semibold flex items-center gap-1">
                          {k.label}
                          <InfoTooltip text={k.tooltip} />
                        </div>
                        <div className="font-display text-[26px] font-bold mt-1.5">{k.value}</div>
                      </div>
                      <div className={`size-[34px] rounded-[9px] flex items-center justify-center ${k.bg} ${k.color}`}>
                        <k.icon className="size-[17px]" />
                      </div>
                    </div>
                    <div className="mt-2.5 text-[11.5px] text-text-faint">{k.sub}</div>
                  </CardContent>
                </Card>
              ))}
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-[18px] mb-[18px]">
          <Card>
            <CardContent className="p-[20px_22px]">
              <div className="font-display font-semibold text-[15.5px] flex items-center gap-1">
                Invoice Volume
                <InfoTooltip text="Invoices grouped by the workspace month they were uploaded into — the same month shown in the selector above, not the date printed on the invoice." />
              </div>
              <div className="text-[12.5px] text-muted-foreground mb-4">Monthly invoices received, last 6 months</div>
              {stats && <VolumeChart data={stats.monthlyVolume} />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-[20px_22px]">
              <div className="font-display font-semibold text-[15.5px] flex items-center gap-1">
                Risk Distribution
                <InfoTooltip text={`How ${monthLabel}'s invoices break down by risk score: Approved (0–19), Flagged (20–74), High Risk (75+).`} />
              </div>
              <div className="text-[12.5px] text-muted-foreground mb-4">Current portfolio breakdown</div>
              {stats && <RiskDonut approved={stats.approved} flagged={stats.flagged} highRisk={stats.highRisk} />}
            </CardContent>
          </Card>
        </div>

        <Card>
          <div className="p-[20px_22px] pb-0">
            <div className="font-display font-semibold text-[15.5px]">Needs Attention</div>
            <div className="text-[12.5px] text-muted-foreground mb-3">Highest-risk invoices awaiting review</div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Consultant</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Est. Overpayment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needsAttention.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <TableCell>
                    <span className="font-mono font-semibold">{inv.invoiceNumber}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                        style={{ background: initialsColor(inv.consultantName ?? inv.vendorName) }}
                      >
                        {initials(inv.consultantName ?? inv.vendorName)}
                      </div>
                      {inv.consultantName}
                    </div>
                  </TableCell>
                  <TableCell>{inv.vendorName}</TableCell>
                  <TableCell className="font-mono">{money(inv.overpay)}</TableCell>
                  <TableCell>
                    <StatusBadge status={inv.riskLabel ?? "Approved"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3.5 px-[18px]">
            <Link
              href="/audit"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              View all in AI Audit <ChevronRight className="size-4" />
            </Link>
          </div>
        </Card>
      </PageContent>
    </>
  );
}

function VolumeChart({ data }: { data: { label: string; value: number }[] }) {
  const w = 560;
  const h = 180;
  const pad = 28;
  const maxV = Math.max(...data.map((d) => d.value), 1) * 1.2;
  const gap = (w - pad * 2) / data.length;
  const barW = gap * 0.55;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {data.map((d, i) => {
        const bh = (d.value / maxV) * (h - pad * 2);
        const x = pad + i * gap + (gap - barW) / 2;
        const y = h - pad - bh;
        const isLast = i === data.length - 1;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={bh} rx={6} fill={isLast ? "var(--primary)" : "var(--border-strong)"} />
            <text x={x + barW / 2} y={h - pad + 16} textAnchor="middle" fontSize="11" fill="var(--text-faint)">
              {d.label}
            </text>
            <text
              x={x + barW / 2}
              y={y - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={isLast ? "var(--primary)" : "var(--muted-foreground)"}
              fontFamily="var(--font-mono-audix)"
            >
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RiskDonut({ approved, flagged, highRisk }: { approved: number; flagged: number; highRisk: number }) {
  const total = approved + flagged + highRisk || 1;
  const data = [
    { label: "Approved", value: approved, color: "var(--success)" },
    { label: "Flagged", value: flagged, color: "var(--warning)" },
    { label: "High Risk", value: highRisk, color: "var(--danger)" },
  ];
  const r = 62;
  const cx = 80;
  const cy = 80;
  const sw = 22;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" width={150} height={150}>
        {data.map((d) => {
          const frac = d.value / total;
          const len = frac * circ;
          const el = (
            <circle
              key={d.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={sw}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += len;
          return el;
        })}
        <text x={80} y={76} textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--foreground)" fontFamily="var(--font-display)">
          {total === 1 && approved + flagged + highRisk === 0 ? 0 : approved + flagged + highRisk}
        </text>
        <text x={80} y={94} textAnchor="middle" fontSize="10.5" fill="var(--text-faint)">
          INVOICES
        </text>
      </svg>
      <div className="flex-1">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-[12.5px] mb-2">
            <span className="size-[9px] rounded-full shrink-0" style={{ background: d.color }} />
            <span className="flex-1 text-muted-foreground">{d.label}</span>
            <span className="font-mono font-semibold">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
