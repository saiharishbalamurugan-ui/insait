"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Wand2, Download, Sparkles, X, Mail, MinusCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useInvoice, useTriggerAudit } from "@/lib/hooks/use-invoice";
import { useReportAction } from "@/lib/hooks/use-reports";
import { money, fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/invoices/status-badge";
import { ConfidenceRing } from "@/components/audit/confidence-ring";
import { downloadAuditReportPDF } from "@/lib/pdf";

const AUDIT_STEPS = [
  { key: "reading", name: "Reading Invoice", detail: "Parsing the attachment and locating key fields" },
  { key: "extracting", name: "Extracting Fields", detail: "Pulling vendor, consultant, hours, rate & amount" },
  { key: "connecting", name: "Connecting to QuickBooks", detail: "Retrieving the approved timesheet record" },
  { key: "comparing", name: "Comparing Records", detail: "Reconciling the invoice against approved hours" },
  { key: "generating", name: "Generating Audit", detail: "Scoring risk and drafting a recommendation" },
];

type Phase = "idle" | "running" | "done" | null;

export function AuditFlow({ invoiceId }: { invoiceId: string }) {
  const [phase, setPhase] = useState<Phase>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const trigger = useTriggerAudit(invoiceId);

  const { data: invoice } = useInvoice(invoiceId, {
    refetchInterval: phase === "running" ? 800 : false,
  });

  useEffect(() => {
    if (phase === null && invoice) {
      if (invoice.status === "AUDITED") setPhase("done");
      else if (invoice.status === "PROCESSING") setPhase("running");
      else setPhase("idle");
    }
  }, [invoice, phase]);

  useEffect(() => {
    if (phase !== "running") return;
    if (stepIdx >= AUDIT_STEPS.length - 1) return;
    const t = setTimeout(() => setStepIdx((i) => i + 1), 620);
    return () => clearTimeout(t);
  }, [phase, stepIdx]);

  useEffect(() => {
    if (phase === "running" && stepIdx >= AUDIT_STEPS.length - 1 && invoice?.status === "AUDITED") {
      const t = setTimeout(() => {
        setPhase("done");
        toast.success(`AI audit complete for ${invoice.invoiceNumber}`);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [phase, stepIdx, invoice]);

  if (!invoice || phase === null) {
    return <Card className="h-64 animate-pulse" />;
  }

  if (phase === "idle") {
    return (
      <Card>
        <CardContent className="text-center py-12 px-6">
          <div className="size-16 rounded-2xl bg-brand-soft text-primary flex items-center justify-center mx-auto mb-4">
            <Wand2 className="size-7" />
          </div>
          <div className="font-display font-bold text-[17px] mb-1.5">Ready to audit {invoice.invoiceNumber}</div>
          <div className="text-muted-foreground max-w-md mx-auto mb-5 text-[13.5px]">
            Audix will read the invoice, extract its fields, pull the matching QuickBooks timesheet, and generate a
            full reconciliation report.
          </div>
          <Button
            size="lg"
            className="gap-2"
            disabled={trigger.isPending}
            onClick={() => trigger.mutate(undefined, { onSuccess: () => setPhase("running") })}
          >
            <Wand2 className="size-4" />
            Run AI Audit
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "running") {
    return (
      <Card className="max-w-[560px] mx-auto">
        <CardContent className="py-6 px-6">
          <div className="text-center mb-5">
            <div className="size-12 rounded-[14px] bg-brand-soft text-primary flex items-center justify-center mx-auto mb-3">
              <Sparkles className="size-5" />
            </div>
            <div className="font-display font-bold text-[16px]">Auditing {invoice.invoiceNumber}</div>
            <div className="text-[12.5px] text-text-faint">Reconciling against the QuickBooks record</div>
          </div>
          <div className="flex flex-col">
            {AUDIT_STEPS.map((step, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={step.key} className="flex gap-3.5 pb-5 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`size-[26px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        done
                          ? "bg-primary border-primary text-white"
                          : active
                            ? "border-primary bg-brand-soft"
                            : "border-border-strong bg-secondary"
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {done ? (
                          <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                            <Check className="size-[13px]" strokeWidth={3} />
                          </motion.div>
                        ) : active ? (
                          <div className="size-[13px] rounded-full border-2 border-brand-soft border-t-primary animate-spin" />
                        ) : null}
                      </AnimatePresence>
                    </div>
                    {i < AUDIT_STEPS.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[18px] mt-0.5 ${done ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <div className={`font-semibold text-[13.5px] ${!done && !active ? "text-text-faint" : ""}`}>
                      {step.name}
                      {active ? "..." : ""}
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{step.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <AuditResults invoice={invoice} />;
}

function AuditResults({ invoice }: { invoice: NonNullable<ReturnType<typeof useInvoice>["data"]> }) {
  const reportAction = useReportAction();
  const report = invoice.latestReport;
  const ts = invoice.matchedTimesheet;
  const checks = invoice.checks;
  const invoiceHours = invoice.hours ?? 0;
  const invoiceRate = invoice.hourlyRate ?? 0;
  const tsAmount = ts ? ts.hours * ts.hourlyRate : null;
  const isClean = !report?.findings.length;
  const action = report?.reviewAction ?? null;

  const hoursCheck = checks?.find((c) => c.rule === "APPROVED_HOURS");
  const rateCheck = checks?.find((c) => c.rule === "BILLING_RATE");
  const rosterHoursMatch = hoursCheck?.expectedValue?.match(/[\d.]+/)?.[0];
  const rosterRateMatch = rateCheck?.expectedValue?.match(/[\d.]+/)?.[0];
  const rosterHours = checks && rosterHoursMatch ? Number(rosterHoursMatch) : null;
  const rosterRate = checks && rosterRateMatch ? Number(rosterRateMatch) : invoiceRate;
  const rosterAmount = rosterHours !== null ? rosterHours * rosterRate : null;
  const hasRosterEntry = checks ? hoursCheck?.discrepancyType !== "MISSING_TIMESHEET" : !!ts;

  const extractedFields: [string, string][] = [
    ["Vendor", invoice.vendorName],
    ["Consultant", invoice.consultantName ?? "—"],
    ["Project", invoice.project ?? "—"],
    ["Hours Billed", `${invoiceHours} hrs`],
    ["Hourly Rate", `$${invoiceRate}/hr`],
    ["Invoice Amount", money(invoice.amount)],
    ["Invoice Number", invoice.invoiceNumber],
  ];

  return (
    <div className="space-y-[18px]">
      <div className="grid grid-cols-2 gap-[18px] items-start">
        <Card>
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="font-display font-semibold text-[15.5px]">Extracted Invoice Data</div>
                <div className="text-[12.5px] text-muted-foreground mb-1">
                  Parsed from invoice_{invoice.invoiceNumber.replace("INV-", "")}.pdf
                </div>
              </div>
              {invoice.confidence !== null && <ConfidenceRing value={invoice.confidence} size={56} />}
            </div>
            {extractedFields.map(([k, v]) => (
              <div key={k} className="flex justify-between py-[9px] border-t border-border text-[13px]">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono font-semibold">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            {checks ? (
              <>
                <div className="font-display font-semibold text-[15.5px]">Consultant Roster Checks</div>
                <div className="text-[12.5px] text-muted-foreground mb-2">
                  5 automated checks against the approved hours sheet
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  {checks.map((c) => (
                    <div key={c.rule} className="flex items-start gap-2 py-1">
                      <div className="shrink-0 mt-0.5">
                        {c.status === "flagged" ? (
                          <div className="size-4 rounded-full bg-danger text-white flex items-center justify-center">
                            <X className="size-2.5" strokeWidth={3} />
                          </div>
                        ) : c.status === "skipped" ? (
                          <MinusCircle className="size-4 text-text-faint" />
                        ) : (
                          <div className="size-4 rounded-full bg-success text-white flex items-center justify-center">
                            <Check className="size-2.5" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[12.5px]">{c.label}</div>
                        <div className="text-[11.5px] text-muted-foreground leading-snug">{c.explanation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="font-display font-semibold text-[15.5px]">QuickBooks Timesheet Match</div>
                <div className="text-[12.5px] text-muted-foreground mb-1">
                  Approved hours for {invoice.consultantName}
                </div>
                {ts ? (
                  <>
                    <Row label="Employee" value={ts.employeeName} />
                    <Row label="Project" value={ts.project ?? "—"} />
                    <Row label="Manager Approval">
                      <StatusBadge status="Approved" />
                      <span className="ml-1.5 text-[13px]">{ts.managerName}</span>
                    </Row>
                    <Row label="Approved Hours" value={`${ts.hours} hrs`} mono />
                    <Row label="Approved Rate" value={`$${ts.hourlyRate}/hr`} mono />
                  </>
                ) : (
                  <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-danger-soft text-danger text-[13px] font-medium">
                    <X className="size-4" /> No matching timesheet found in QuickBooks
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 pb-3.5">
          <div className="font-display font-semibold text-[15.5px]">Reconciliation</div>
          <div className="text-[12.5px] text-muted-foreground">
            Invoice vs. approved {checks ? "roster" : "QuickBooks"} record
          </div>
        </div>
        <div className="flex border-t border-b border-border">
          <div className="flex-1 p-5 bg-surface-2">
            <div className="text-[10.5px] uppercase tracking-wide text-text-faint font-bold mb-2.5">
              Invoice Hours
            </div>
            <div className="font-mono text-[26px] font-semibold">
              {invoiceHours} <span className="text-[14px] font-medium text-muted-foreground">hrs</span>
            </div>
            <div className="flex justify-between text-[12.5px] pt-2 mt-2 border-t border-dashed border-border">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono">${invoiceRate}/hr</span>
            </div>
            <div className="flex justify-between text-[12.5px] pt-1.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">{money(invoice.amount)}</span>
            </div>
          </div>
          <div className="w-0 border-l-2 border-dashed border-border-strong" />
          <div className="flex-1 p-5 bg-surface-2">
            <div className="text-[10.5px] uppercase tracking-wide text-text-faint font-bold mb-2.5">
              {checks ? "Approved Hours" : "QuickBooks Hours"}
            </div>
            <div className="font-mono text-[26px] font-semibold">
              {checks ? (hasRosterEntry ? (rosterHours ?? invoiceHours) : 0) : ts ? ts.hours : 0}{" "}
              <span className="text-[14px] font-medium text-muted-foreground">hrs</span>
            </div>
            <div className="flex justify-between text-[12.5px] pt-2 mt-2 border-t border-dashed border-border">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-mono">
                ${checks ? (hasRosterEntry ? rosterRate : 0) : ts ? ts.hourlyRate : 0}/hr
              </span>
            </div>
            <div className="flex justify-between text-[12.5px] pt-1.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">
                {money(checks ? (hasRosterEntry ? (rosterAmount ?? 0) : 0) : (tsAmount ?? 0))}
              </span>
            </div>
          </div>
        </div>
        <div
          className={`flex items-center justify-between px-5 py-3.5 ${invoice.overpay > 0 ? "bg-danger-soft" : "bg-success-soft"}`}
        >
          <div className={`font-bold text-[13.5px] ${invoice.overpay > 0 ? "text-danger" : "text-success"}`}>
            {report?.findings[0] ? report.findings[0].discrepancyType.replace(/_/g, " ") : "No discrepancy"}
          </div>
          <div className={`font-mono font-bold text-[15px] ${invoice.overpay > 0 ? "text-danger" : "text-success"}`}>
            {invoice.overpay > 0 ? `Est. Overpayment: ${money(invoice.overpay)}` : "No overpayment detected"}
          </div>
        </div>
      </Card>

      <Card>
        <CardContent className="p-5 flex gap-4">
          <div className="size-[38px] rounded-[9px] bg-indigo-soft text-indigo flex items-center justify-center shrink-0">
            <Sparkles className="size-[18px]" />
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-[15.5px] mb-2">Audit Analysis</div>
            {report?.findings.length ? (
              <div className="space-y-3">
                {report.findings.map((f) => (
                  <div key={f.id}>
                    <div className="font-bold text-[14px] mb-1">{f.discrepancyType.replace(/_/g, " ")}</div>
                    <div className="text-[13.5px] text-muted-foreground leading-relaxed">{f.explanation}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13.5px] text-muted-foreground leading-relaxed">{report?.summary}</div>
            )}
            <div className="flex gap-5 mt-3.5">
              {invoice.confidence !== null && (
                <div>
                  <div className="text-[11px] font-bold text-text-faint">CONFIDENCE</div>
                  <div className="font-mono font-bold text-[15px]">{invoice.confidence.toFixed(1)}%</div>
                </div>
              )}
              <div>
                <div className="text-[11px] font-bold text-text-faint">RISK</div>
                <div
                  className={`font-bold text-[15px] ${invoice.riskLabel === "High Risk" ? "text-danger" : invoice.riskLabel === "Flagged" ? "text-warning" : "text-success"}`}
                >
                  {invoice.riskLabel === "Approved" ? "Low" : invoice.riskLabel}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <div className="font-display font-semibold text-[15.5px]">Audit Report</div>
              <div className="text-[12.5px] text-muted-foreground">
                {invoice.invoiceNumber} · Generated {fmtDate(invoice.issueDate)}
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadAuditReportPDF(invoice)}>
              <Download className="size-3.5" /> Download PDF
            </Button>
          </div>
          <div className="h-px bg-border mb-3.5" />
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-secondary rounded-lg p-3.5">
              <div className="text-[11px] uppercase tracking-wide text-text-faint font-bold mb-1">Risk Score</div>
              <div
                className={`font-semibold ${invoice.riskLabel === "High Risk" ? "text-danger" : invoice.riskLabel === "Flagged" ? "text-warning" : "text-success"}`}
              >
                {invoice.riskScore ?? 0}/100
              </div>
            </div>
            <div className="bg-secondary rounded-lg p-3.5">
              <div className="text-[11px] uppercase tracking-wide text-text-faint font-bold mb-1">
                Est. Overpayment
              </div>
              <div className="font-mono font-semibold">{money(invoice.overpay)}</div>
            </div>
            <div className="bg-secondary rounded-lg p-3.5">
              <div className="text-[11px] uppercase tracking-wide text-text-faint font-bold mb-1">
                Recommendation
              </div>
              <div className="font-semibold text-[13px]">{isClean ? "Clear for Payment" : "Hold for Review"}</div>
            </div>
          </div>

          {isClean ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success-soft text-success font-semibold text-[13px]">
              <Check className="size-4" /> This invoice is cleared for standard payment — no action needed.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!!action || reportAction.isPending}
                  className="gap-1.5"
                  onClick={() =>
                    report && reportAction.mutate({ reportId: report.id, action: "APPROVED" }, { onSuccess: () => toast.success("Payment approved") })
                  }
                >
                  <Check className="size-3.5" /> Approve Payment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-transparent bg-danger-soft text-danger hover:bg-danger-soft/80"
                  disabled={!!action || reportAction.isPending}
                  onClick={() =>
                    report && reportAction.mutate({ reportId: report.id, action: "REJECTED" }, { onSuccess: () => toast.success("Invoice rejected") })
                  }
                >
                  <X className="size-3.5" /> Reject Invoice
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!!action || reportAction.isPending}
                  onClick={() =>
                    report &&
                    reportAction.mutate(
                      { reportId: report.id, action: "CLARIFICATION_REQUESTED" },
                      { onSuccess: () => toast.success("Clarification requested from vendor") },
                    )
                  }
                >
                  <Mail className="size-3.5" /> Request Clarification
                </Button>
              </div>
              {action && (
                <div className="text-[12.5px] font-semibold text-primary flex items-center gap-1.5">
                  <Check className="size-3.5" /> Action recorded — this decision has been logged to the audit trail.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono, children }: { label: string; value?: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between py-[9px] border-t border-border text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      {children ?? <span className={mono ? "font-mono font-semibold" : "font-semibold"}>{value}</span>}
    </div>
  );
}
