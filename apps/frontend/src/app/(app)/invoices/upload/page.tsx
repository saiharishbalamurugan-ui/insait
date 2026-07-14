"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExtractInvoice, useCreateInvoice } from "@/lib/hooks/use-upload-invoice";
import { ExtractedInvoiceData } from "@/lib/types";
import { ApiError } from "@/lib/api-client";

type Stage = "pick" | "extracting" | "review";

export default function UploadInvoicePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [fields, setFields] = useState<ExtractedInvoiceData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const extract = useExtractInvoice();
  const create = useCreateInvoice();

  function handleFile(file: File) {
    setFileName(file.name);
    setStage("extracting");
    extract.mutate(file, {
      onSuccess: (data) => {
        setFields(data);
        setStage("review");
      },
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : "Couldn't read that file — try again.";
        toast.error(message);
        setStage("pick");
      },
    });
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
        fileUrl: fields.fileUrl,
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

  return (
    <>
      <Topbar />
      <PageContent className="max-w-[720px]">
        <div className="mb-5">
          <div className="font-display font-semibold text-[15.5px]">Upload Invoice</div>
          <div className="text-[12.5px] text-muted-foreground">
            Upload a PDF or image and Audix will read it — you review before it's saved.
          </div>
        </div>

        {stage === "pick" && (
          <Card>
            <CardContent className="p-0">
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
                className={`m-5 rounded-xl border-2 border-dashed p-14 text-center cursor-pointer transition-colors ${
                  dragActive ? "border-primary bg-brand-soft" : "border-border-strong hover:bg-secondary"
                }`}
              >
                <div className="size-14 rounded-2xl bg-brand-soft text-primary flex items-center justify-center mx-auto mb-4">
                  <UploadCloud className="size-6" />
                </div>
                <div className="font-semibold text-[14.5px] mb-1">Drop an invoice here, or click to browse</div>
                <div className="text-[12.5px] text-text-faint">PDF, PNG, JPEG, or WebP — up to 20MB</div>
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
