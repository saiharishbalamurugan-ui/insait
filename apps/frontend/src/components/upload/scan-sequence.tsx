"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, X, MinusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { CheckResult, ExtractedInvoiceData } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api-client";

// react-pdf touches browser-only APIs (DOMMatrix, Canvas) at module-evaluation time,
// which crashes Next.js's build-time prerendering unless this stays client-only.
const AnnotatedInvoiceViewer = dynamic(
  () => import("@/components/document/annotated-invoice-viewer").then((m) => m.AnnotatedInvoiceViewer),
  { ssr: false },
);

export function ScanSequence({
  data,
  onComplete,
}: {
  data: ExtractedInvoiceData;
  onComplete: () => void;
}) {
  const checks = data.checks;
  const [currentIndex, setCurrentIndex] = useState(-1);

  return (
    <div className="grid grid-cols-[620px_1fr] gap-6 items-start">
      <AnnotatedInvoiceViewer
        fileUrl={`${API_BASE_URL}${data.fileUrl}`}
        mimeType={data.mimeType}
        fieldPositions={data.fieldPositions}
        checks={checks}
        autoPlay
        onFirstPlayComplete={onComplete}
        onStepChange={(index) => setCurrentIndex(index)}
      />
      <div className="flex flex-col gap-2.5 pt-1">
        {checks.map((check, i) => (
          <StepRow key={check.rule} check={check} state={i < currentIndex ? "done" : i === currentIndex ? "active" : "pending"} />
        ))}
      </div>
    </div>
  );
}

function StepRow({ check, state }: { check: CheckResult; state: "done" | "active" | "pending" }) {
  const icon =
    state === "pending" ? (
      <div className="size-5 rounded-full border-2 border-border-strong bg-secondary" />
    ) : state === "active" ? (
      <Loader2 className="size-5 animate-spin text-indigo" />
    ) : check.status === "flagged" ? (
      <div className="size-5 rounded-full bg-danger text-white flex items-center justify-center">
        <X className="size-3" strokeWidth={3} />
      </div>
    ) : check.status === "warning" ? (
      <div className="size-5 rounded-full bg-warning text-white flex items-center justify-center">
        <AlertTriangle className="size-3" strokeWidth={2.5} />
      </div>
    ) : check.status === "skipped" ? (
      <div className="size-5 rounded-full bg-secondary text-text-faint flex items-center justify-center">
        <MinusCircle className="size-3" strokeWidth={2.5} />
      </div>
    ) : (
      <div className="size-5 rounded-full bg-success text-white flex items-center justify-center">
        <Check className="size-3" strokeWidth={3} />
      </div>
    );

  return (
    <div className={`flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${state === "active" ? "border-indigo bg-indigo-soft" : "border-border bg-card"}`}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className={`font-semibold text-[13px] ${state === "pending" ? "text-text-faint" : ""}`}>
          {check.label}
          {state === "active" ? "…" : ""}
        </div>
        {state !== "pending" && (
          <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            {state === "active" ? "Checking…" : check.explanation}
          </div>
        )}
      </div>
    </div>
  );
}
