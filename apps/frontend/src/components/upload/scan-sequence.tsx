"use client";

import { useEffect, useState } from "react";
import { Check, X, MinusCircle, Loader2 } from "lucide-react";
import { CheckResult, ExtractedInvoiceData } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api-client";
import { DocumentAnnotator, AnnotationBox } from "./document-annotator";

const STEP_DURATION_MS = 900;

export function ScanSequence({
  data,
  onComplete,
}: {
  data: ExtractedInvoiceData;
  onComplete: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const checks = data.checks;

  useEffect(() => {
    if (stepIdx >= checks.length) {
      const t = setTimeout(onComplete, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), STEP_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, checks.length]);

  const boxes: AnnotationBox[] = [];
  checks.forEach((check, i) => {
    if (i > stepIdx) return;
    const tone = i === stepIdx ? "active" : check.status === "flagged" ? "flagged" : "passed";
    for (const field of check.relatedFields) {
      const existing = boxes.find((b) => b.field === field);
      if (!existing || tone !== "active") {
        if (existing) existing.tone = tone;
        else boxes.push({ field, tone });
      }
    }
  });

  return (
    <div className="grid grid-cols-[620px_1fr] gap-6 items-start">
      <DocumentAnnotator
        fileUrl={`${API_BASE_URL}${data.fileUrl}`}
        mimeType={data.mimeType}
        fieldPositions={data.fieldPositions}
        boxes={boxes}
      />
      <div className="flex flex-col gap-2.5 pt-1">
        {checks.map((check, i) => (
          <StepRow key={check.rule} check={check} state={i < stepIdx ? "done" : i === stepIdx ? "active" : "pending"} />
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
