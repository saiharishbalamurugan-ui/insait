"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileText, Loader2, Check, X, Lock, ArrowRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";
import { ExtractedInvoiceData, InvoiceDetail } from "@/lib/types";
import { useMonthContext } from "@/lib/hooks/use-month";

const MAX_FILES = 25;
const CONCURRENCY = 3;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type FileStatus = "pending" | "extracting" | "saving" | "done" | "failed";

interface BatchItem {
  file: File;
  status: FileStatus;
  error?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  flaggedCount?: number;
}

async function extractInvoice(file: File, receivedDate: string): Promise<ExtractedInvoiceData> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("receivedDate", receivedDate);
  return apiClient.postFormData<ExtractedInvoiceData>("/invoices/extract", formData);
}

async function createInvoice(fields: ExtractedInvoiceData): Promise<InvoiceDetail> {
  return apiClient.post<InvoiceDetail>("/invoices", {
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
  });
}

export default function BulkUploadPage() {
  const queryClient = useQueryClient();
  const { isViewingCurrent, currentMonthLabel } = useMonthContext();
  const [receivedDate, setReceivedDate] = useState(todayISO());
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

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
                {currentMonthLabel} to bulk upload.
              </div>
            </CardContent>
          </Card>
        </PageContent>
      </>
    );
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).slice(0, MAX_FILES - items.length);
    setItems((prev) => [...prev, ...incoming.map((file) => ({ file, status: "pending" as FileStatus }))]);
  }

  function updateItem(index: number, patch: Partial<BatchItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function processOne(index: number) {
    updateItem(index, { status: "extracting" });
    try {
      const fields = await extractInvoice(items[index].file, receivedDate);
      updateItem(index, { status: "saving" });
      const invoice = await createInvoice(fields);
      const flaggedCount = fields.checks.filter((c) => c.status === "flagged" || c.status === "warning").length;
      updateItem(index, { status: "done", invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, flaggedCount });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't process this file.";
      updateItem(index, { status: "failed", error: message });
    }
  }

  async function startBatch() {
    setIsRunning(true);
    const queue = items.map((_, i) => i).filter((i) => items[i].status === "pending" || items[i].status === "failed");
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const index = queue[cursor++];
        await processOne(index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setIsRunning(false);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const finished = items.length > 0 && !isRunning && doneCount + failedCount === items.length;

  return (
    <>
      <Topbar />
      <PageContent className="max-w-[760px]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="font-display font-semibold text-[15.5px]">Bulk Upload</div>
            <div className="text-[12.5px] text-muted-foreground">
              Upload up to {MAX_FILES} vendor invoices at once — each is read, checked, and saved independently, so
              one bad file won't stop the rest.
            </div>
          </div>
          <Link href="/invoices/upload" className="text-[12.5px] text-primary hover:underline flex items-center gap-1 shrink-0">
            Single invoice instead <ArrowRight className="size-3" />
          </Link>
        </div>

        <Card className="mb-[18px]">
          <CardContent className="p-5">
            <div className="max-w-[240px] mb-4">
              <Label className="text-[11.5px] text-text-faint font-semibold mb-1.5 block">
                Email received date (applies to the whole batch) *
              </Label>
              <Input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                max={todayISO()}
                disabled={isRunning}
              />
            </div>

            <div
              onClick={() => !isRunning && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isRunning) setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (isRunning) return;
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                dragActive ? "border-primary bg-brand-soft" : "border-border-strong hover:bg-secondary"
              } ${isRunning ? "pointer-events-none opacity-60" : ""}`}
            >
              <UploadCloud className="size-5 mx-auto mb-2 text-text-faint" />
              <div className="text-[12.5px] font-semibold">Drop up to {MAX_FILES} files, or click to browse</div>
              <div className="text-[11px] text-text-faint mt-0.5">PDF, PNG, JPEG, WebP — up to 20MB each</div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {items.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-[12.5px] text-text-faint">
                  {items.length} file{items.length > 1 ? "s" : ""} selected
                  {finished && ` — ${doneCount} saved, ${failedCount} failed`}
                </div>
                <Button size="sm" className="gap-1.5" disabled={isRunning || items.length === 0} onClick={startBatch}>
                  {isRunning && <Loader2 className="size-3.5 animate-spin" />}
                  {isRunning ? "Processing…" : finished ? "Retry Failed" : "Start Bulk Upload"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {items.length > 0 && (
          <Card>
            <div className="p-5 pb-3.5 border-b border-border">
              <div className="font-display font-semibold text-[15.5px]">Batch Progress</div>
            </div>
            <div>
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-b-0">
                  <div className="shrink-0">
                    {item.status === "pending" && <div className="size-5 rounded-full border-2 border-border-strong bg-secondary" />}
                    {(item.status === "extracting" || item.status === "saving") && (
                      <Loader2 className="size-5 animate-spin text-indigo" />
                    )}
                    {item.status === "done" && (
                      <div className="size-5 rounded-full bg-success text-white flex items-center justify-center">
                        <Check className="size-3" strokeWidth={3} />
                      </div>
                    )}
                    {item.status === "failed" && (
                      <div className="size-5 rounded-full bg-danger text-white flex items-center justify-center">
                        <X className="size-3" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <FileText className="size-3.5 text-text-faint shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate">{item.file.name}</div>
                    {item.status === "extracting" && <div className="text-[11.5px] text-text-faint">Reading document…</div>}
                    {item.status === "saving" && <div className="text-[11.5px] text-text-faint">Running checks & saving…</div>}
                    {item.status === "failed" && <div className="text-[11.5px] text-danger">{item.error}</div>}
                  </div>
                  {item.status === "done" && item.invoiceId && (
                    <Link
                      href={`/invoices/${item.invoiceId}`}
                      className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full shrink-0 bg-secondary text-muted-foreground hover:bg-brand-soft hover:text-primary"
                    >
                      {item.invoiceNumber}
                      {item.flaggedCount ? ` · ${item.flaggedCount} flagged` : " · clean"}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </PageContent>
    </>
  );
}
