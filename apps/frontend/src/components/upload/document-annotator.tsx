"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ExtractableField, FieldPosition } from "@/lib/types";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PAGE_WIDTH = 620;

export interface AnnotationBox {
  field: ExtractableField;
  tone: "active" | "passed" | "warning" | "flagged";
  label?: string;
}

const TONE_STYLES: Record<AnnotationBox["tone"], string> = {
  active: "border-indigo shadow-[0_0_0_3px_var(--indigo-soft)]",
  passed: "border-success shadow-[0_0_0_3px_var(--success-soft)]",
  warning: "border-warning shadow-[0_0_0_3px_var(--warning-soft)]",
  flagged: "border-danger shadow-[0_0_0_3px_var(--danger-soft)]",
};

export function DocumentAnnotator({
  fileUrl,
  mimeType,
  fieldPositions,
  boxes,
}: {
  fileUrl: string;
  mimeType: string;
  fieldPositions: FieldPosition[];
  boxes: AnnotationBox[];
}) {
  const [numPages, setNumPages] = useState<number>(1);
  const [loaded, setLoaded] = useState(false);
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    setLoaded(false);
  }, [fileUrl]);

  return (
    <div className="relative mx-auto rounded-lg overflow-hidden border border-border bg-secondary" style={{ width: PAGE_WIDTH }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-secondary">
          <Loader2 className="size-6 animate-spin text-text-faint" />
        </div>
      )}

      {isPdf ? (
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            setLoaded(true);
          }}
          onLoadError={() => setLoaded(true)}
          loading={null}
        >
          <Page pageNumber={1} width={PAGE_WIDTH} renderAnnotationLayer={false} renderTextLayer={false} />
        </Document>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt="Uploaded invoice" className="w-full block" onLoad={() => setLoaded(true)} />
      )}

      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence>
          {boxes.map(({ field, tone, label }) => {
            const pos = fieldPositions.find((p) => p.field === field && p.page === 1);
            if (!pos) return null;
            return (
              <motion.div
                key={field}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`absolute rounded-[3px] border-2 ${TONE_STYLES[tone]}`}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  width: `${pos.width * 100}%`,
                  height: `${pos.height * 100}%`,
                }}
              >
                {tone !== "active" && (
                  <div
                    className={`absolute -top-2.5 -right-2.5 size-4 rounded-full flex items-center justify-center text-white ${
                      tone === "passed" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-danger"
                    }`}
                  >
                    {tone === "passed" ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
                  </div>
                )}
                {label && (
                  <div
                    className={`absolute -bottom-6 left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
                      tone === "passed"
                        ? "bg-success text-white"
                        : tone === "warning"
                          ? "bg-warning text-white"
                          : tone === "flagged"
                            ? "bg-danger text-white"
                            : "bg-indigo text-white"
                    }`}
                  >
                    {label}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {numPages > 1 && (
        <div className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
          Page 1 of {numPages}
        </div>
      )}
    </div>
  );
}
