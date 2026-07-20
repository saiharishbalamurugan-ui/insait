"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, Loader2, Sparkles, AlertTriangle, Users, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExtractInvoice, useCreateInvoice, useRecomputeChecks } from "@/lib/hooks/use-upload-invoice";
import { ExtractedInvoiceData } from "@/lib/types";
import { ApiError } from "@/lib/api-client";
import { ScanSequence } from "@/components/upload/scan-sequence";
import { useMonthContext } from "@/lib/hooks/use-month";
import { PaymentTermsPicker } from "@/components/upload/payment-terms-picker";

type Stage = "pick" | "received-date" | "extracting" | "terms-select" | "scanning" | "review";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function UploadInvoicePage() {
  const router = useRouter();
  const { isViewingCurrent, currentMonthLabel } = useMonthContext();
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [fields, setFields] = useState<ExtractedInvoiceData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const extract = useExtractInvoice();
  const create = useCreateInvoice();
  const recomputeChecks = useRecomputeChecks();

  if (currentMonthLabel && !isViewingCurrent) {
    return (
      <>
        <Topbar />
        <PageContent className="max-w-[720px]">
          <Card>
            <CardContent className="text-center py-16 px-6">
              <div className="size-14 rounded-2xl bg-secondary text-text-faint flex items-center justify-center mx-auto mb-4">
                <Lock className="size-6" />
              </div>
              <div className="font-display font-semibold text-[15px] mb-1">You're viewing a historical month</div>
              <div className="text-[12.5px] text-text-faint max-w-sm mx-auto">
                Uploads always go into the current month. Switch the month selector at the top back to{" "}
                {currentMonthLabel} to upload an invoice.
              </div>
            </CardContent>
          </Card>
        </PageContent>
      </>
    );
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setPendingFile(file);
    setStage("received-date");
  }

  function startExtraction() {
    if (!pendingFile) return;
    setStage("extracting");
    extract.mutate(
      { file: pendingFile, receivedDate },
      {
        onSuccess: (data) => {
          setFields(data);
          setStage(data.paymentTermsDays === null ? "terms-select" : "scanning");
        },
        onError: (err) => {
          const message = err instanceof ApiError ? err.message : "Couldn't read that file — try again.";
          toast.error(message);
          setStage("pick");
        },
      },
    );
  }

  function submitPaymentTerms(label: string, days: number) {
    if (!fields) return;
    recomputeChecks.mutate(
      { ...fields, paymentTermsLabel: label, paymentTermsDays: days, receivedDate },
      {
        onSuccess: ({ checks }) => {
          setFields((f) => (f ? { ...f, paymentTermsLabel: label, paymentTermsDays: days, checks } : f));
          setStage("scanning");
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Couldn't apply those payment terms — try again.");
        },
      },
    );
  }

  function updateField<K extends keyof ExtractedInvoiceData>(key: K, value: ExtractedInvoiceData[K]) {
    setFields((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleSave() {
    if (!fields) return;
    if (!fields.vendorName.trim() || !fields.invoiceNumber.trim() || !fields.amount || !fields.issueDate) {
      toast.error("Vendor, invoice number, amount, and issue date are required.");
      return;
    }
    create.mutate(
      {
        vendorName: fields.vendorName,
        invoiceNumber: fields.invoiceNumber,
        consultantName: fields.consultantName,
        project: fields.project,
        hours: fields.hours,
        hourlyRate: fields.hourlyRate,
        amount: fields.amount,
        issueDate: fields.issueDate,
        dueDate: fields.dueDate,
        periodStart: fields.periodStart,
        periodEnd: fields.periodEnd,
        paymentTermsLabel: fields.paymentTermsLabel,
        paymentTermsDays: fields.paymentTermsDays,
        fileUrl: fields.fileUrl,
        uploadedAt: fields.uploadedAt,
        receivedDate: fields.receivedDate,
        extractedData: fields,
      },
      {
        onSuccess: (invoice) => {
          toast.success(`${invoice.invoiceNumber} saved`);
          router.push(`/invoices/${invoice.id}`);
        },
        onError: (err) => {
          const message = err instanceof ApiError ? err.message : "Couldn't save the invoice — try again.";
          toast.error(message);
        },
      },
    );
  }

  const flaggedCount = fields?.checks.filter((c) => c.status === "flagged" || c.status === "warning").length ?? 0;

  return (
    <>
      <Topbar />
      <PageContent className={stage === "scanning" ? "max-w-[1080px]" : "max-w-[720px]"}>
        {stage === "pick" && (
          <>
            <div className="mb-5">
              <div className="font-display font-semibold text-[15.5px]">Get Started</div>
              <div className="text-[12.5px] text-muted-foreground">
                Two things feed Audix: the hours your consultants actually worked, and the invoices vendors send you
                for them.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <Link href="/roster" className="block">
                <Card className="h-full transition-colors hover:border-primary cursor-pointer">
                  <CardContent className="p-6">
                    <div className="size-11 rounded-2xl bg-brand-soft text-primary flex items-center justify-center mb-4">
                      <Users className="size-5" />
                    </div>
                    <div className="font-semibold text-[14.5px] mb-1 flex items-center gap-1.5">
                      Upload Hours Sheet <ArrowRight className="size-3.5" />
                    </div>
                    <div className="text-[12.5px] text-muted-foreground leading-relaxed">
                      Load the CSV or Excel sheet of approved hours and rates. Do this first — it's what invoices get
                      checked against.
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Card className="h-full">
                <CardContent className="p-6">
                  <div className="size-11 rounded-2xl bg-indigo-soft text-indigo flex items-center justify-center mb-4">
                    <FileText className="size-5" />
                  </div>
                  <div className="font-semibold text-[14.5px] mb-1">Upload Invoice</div>
                  <div className="text-[12.5px] text-muted-foreground leading-relaxed mb-4">
                    Upload a vendor invoice and watch Audix read it, mark it up, and run 7 checks live.
                  </div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFile(file);
                    }}
                    className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                      dragActive ? "border-primary bg-brand-soft" : "border-border-strong hover:bg-secondary"
                    }`}
                  >
                    <UploadCloud className="size-5 mx-auto mb-2 text-text-faint" />
                    <div className="text-[12.5px] font-semibold">Drop a file, or click to browse</div>
                    <div className="text-[11px] text-text-faint mt-0.5">PDF, PNG, JPEG, WebP — up to 20MB</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {stage === "received-date" && (
          <Card>
            <CardContent className="text-center py-12 px-6">
              <div className="size-14 rounded-2xl bg-brand-soft text-primary flex items-center justify-center mx-auto mb-4">
                <FileText className="size-6" />
              </div>
              <div className="font-display font-semibold text-[15px] mb-1">When did this email arrive?</div>
              <div className="text-[12.5px] text-text-faint max-w-sm mx-auto mb-5">
                Audix uses the date {fileName} actually landed in your inbox — not today's date — to validate the
                due date against the vendor's payment terms.
              </div>
              <div className="max-w-[220px] mx-auto text-left mb-5">
                <Label className="text-[11.5px] text-text-faint font-semibold mb-1.5 block">Email received date *</Label>
                <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} max={todayISO()} />
              </div>
              <div className="flex gap-2 justify-center">
                <Button className="gap-1.5" disabled={!receivedDate} onClick={startExtraction}>
                  Continue
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStage("pick");
                    setPendingFile(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "extracting" && (
          <Card>
            <CardContent className="text-center py-16 px-6">
              <div className="size-14 rounded-2xl bg-brand-soft text-primary flex items-center justify-center mx-auto mb-4">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <div className="font-display font-semibold text-[15px] mb-1">Reading {fileName}…</div>
              <div className="text-[12.5px] text-text-faint">
                Audix is extracting the vendor, consultant, hours, and amount from the document.
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "terms-select" && fields && (
          <PaymentTermsPicker
            fileName={fileName}
            isPending={recomputeChecks.isPending}
            onSubmit={submitPaymentTerms}
          />
        )}

        {stage === "scanning" && fields && (
          <div>
            <div className="mb-5 text-center">
              <div className="font-display font-semibold text-[15.5px]">Auditing {fields.invoiceNumber}</div>
              <div className="text-[12.5px] text-muted-foreground">Running 7 checks against the consultant roster</div>
            </div>
            <ScanSequence data={fields} onComplete={() => setStage("review")} />
          </div>
        )}

        {stage === "review" && fields && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="size-8 rounded-[9px] bg-indigo-soft text-indigo flex items-center justify-center shrink-0">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-[13.5px]">Review before saving</div>
                  <div className="text-[11.5px] text-text-faint flex items-center gap-1">
                    <FileText className="size-3" /> {fileName}
                  </div>
                </div>
                {flaggedCount > 0 && (
                  <span className="ml-auto text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-danger-soft text-danger">
                    {flaggedCount} check{flaggedCount > 1 ? "s" : ""} need{flaggedCount > 1 ? "" : "s"} attention
                  </span>
                )}
              </div>

              <div className="mt-2 mb-4 flex items-start gap-2 rounded-lg bg-warning-soft text-warning px-3 py-2.5 text-[12.5px]">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  These fields came from AI reading the document — double-check them, especially numbers, before
                  saving.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Vendor *">
                  <Input value={fields.vendorName} onChange={(e) => updateField("vendorName", e.target.value)} />
                </Field>
                <Field label="Invoice number *">
                  <Input value={fields.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} />
                </Field>
                <Field label="Consultant">
                  <Input
                    value={fields.consultantName ?? ""}
                    onChange={(e) => updateField("consultantName", e.target.value || null)}
                  />
                </Field>
                <Field label="Project">
                  <Input value={fields.project ?? ""} onChange={(e) => updateField("project", e.target.value || null)} />
                </Field>
                <Field label="Hours">
                  <Input
                    type="number"
                    value={fields.hours ?? ""}
                    onChange={(e) => updateField("hours", e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
                <Field label="Hourly rate ($)">
                  <Input
                    type="number"
                    value={fields.hourlyRate ?? ""}
                    onChange={(e) => updateField("hourlyRate", e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
                <Field label="Amount ($) *">
                  <Input
                    type="number"
                    value={fields.amount ?? ""}
                    onChange={(e) => updateField("amount", e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
                <Field label="Issue date *">
                  <Input
                    type="date"
                    value={fields.issueDate ?? ""}
                    onChange={(e) => updateField("issueDate", e.target.value || null)}
                  />
                </Field>
                <Field label="Due date">
                  <Input
                    type="date"
                    value={fields.dueDate ?? ""}
                    onChange={(e) => updateField("dueDate", e.target.value || null)}
                  />
                </Field>
                <Field label="Payment terms">
                  <Input
                    value={fields.paymentTermsLabel ?? ""}
                    disabled
                    placeholder="Not detected"
                    className="text-text-faint"
                  />
                </Field>
              </div>

              <div className="flex gap-2 mt-5">
                <Button className="gap-1.5" disabled={create.isPending} onClick={handleSave}>
                  {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Save Invoice
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStage("pick");
                    setFields(null);
                  }}
                >
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContent>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11.5px] text-text-faint font-semibold mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
