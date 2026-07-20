"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  AlertTriangle,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  StepBack,
  StepForward,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { CheckResult, ExtractableField, FieldPosition } from "@/lib/types";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PAGE_WIDTH = 620;
const STEP_DURATION_MS = 1100;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2;
// Amount-shaped values read better as a circled figure than a boxed one
const CIRCLE_FIELDS: ExtractableField[] = ["amount", "hourlyRate"];

type Tone = "active" | "passed" | "warning" | "flagged";

interface Box {
  field: ExtractableField;
  tone: Tone;
  check: CheckResult;
}

const TONE_RING: Record<Tone, string> = {
  active: "border-indigo shadow-[0_0_0_3px_var(--indigo-soft)]",
  passed: "border-success shadow-[0_0_0_3px_var(--success-soft)]",
  warning: "border-warning shadow-[0_0_0_3px_var(--warning-soft)]",
  flagged: "border-danger shadow-[0_0_0_3px_var(--danger-soft)]",
};
const TONE_BADGE: Record<Tone, string> = {
  active: "bg-indigo",
  passed: "bg-success",
  warning: "bg-warning",
  flagged: "bg-danger",
};

function toneFor(status: CheckResult["status"]): Tone | null {
  if (status === "passed") return "passed";
  if (status === "warning") return "warning";
  if (status === "flagged") return "flagged";
  return null; // skipped checks don't get a box
}

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="size-8 rounded-lg border border-border-strong bg-card text-muted-foreground flex items-center justify-center hover:bg-secondary hover:text-foreground disabled:opacity-35 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

/** Connects two field boxes with a bent line — used to visualize "terms -> due date" reasoning. */
function ArrowConnector({ from, to }: { from: FieldPosition; to: FieldPosition }) {
  const fx = (from.x + from.width / 2) * 100;
  const fy = (from.y + from.height / 2) * 100;
  const tx = (to.x + to.width / 2) * 100;
  const ty = (to.y + to.height / 2) * 100;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--indigo)" />
        </marker>
      </defs>
      <motion.line
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        x1={`${fx}%`}
        y1={`${fy}%`}
        x2={`${tx}%`}
        y2={`${ty}%`}
        stroke="var(--indigo)"
        strokeWidth={2}
        strokeDasharray="5 4"
        markerEnd="url(#arrowhead)"
      />
    </svg>
  );
}

export function AnnotatedInvoiceViewer({
  fileUrl,
  mimeType,
  fieldPositions,
  checks,
  autoPlay = false,
  onFirstPlayComplete,
  onStepChange,
}: {
  fileUrl: string;
  mimeType: string;
  fieldPositions: FieldPosition[];
  checks: CheckResult[];
  autoPlay?: boolean;
  onFirstPlayComplete?: () => void;
  onStepChange?: (currentIndex: number, playing: boolean) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(autoPlay ? -1 : checks.length - 1);
  const [playing, setPlaying] = useState(autoPlay);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activePopover, setActivePopover] = useState<ExtractableField | null>(null);
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    if (!playing) return;
    if (currentIndex >= checks.length - 1) {
      setPlaying(false);
      if (!hasCompletedOnce) {
        setHasCompletedOnce(true);
        onFirstPlayComplete?.();
      }
      return;
    }
    const t = setTimeout(() => setCurrentIndex((i) => i + 1), STEP_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, currentIndex]);

  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(() => setCurrentIndex(0), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStepChange?.(currentIndex, playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playing]);

  const boxes = useMemo<Box[]>(() => {
    const result: Box[] = [];
    checks.forEach((check, i) => {
      if (i > currentIndex) return;
      const isActive = i === currentIndex && playing;
      const resolvedTone = toneFor(check.status);
      if (!isActive && resolvedTone === null) return; // skipped & not currently active -> no box
      const tone: Tone = isActive ? "active" : (resolvedTone ?? "passed");
      for (const field of check.relatedFields) {
        const existingIdx = result.findIndex((b) => b.field === field);
        if (existingIdx === -1) result.push({ field, tone, check });
        else if (tone !== "active") result[existingIdx] = { field, tone, check };
      }
    });
    return result;
  }, [checks, currentIndex, playing]);

  useEffect(() => {
    if (currentIndex < 0 || currentIndex >= checks.length) return;
    const activeCheck = checks[currentIndex];
    const pos = fieldPositions.find((p) => activeCheck.relatedFields.includes(p.field));
    if (pos) setCurrentPage(pos.page);
  }, [currentIndex, checks, fieldPositions]);

  const activeCheck = currentIndex >= 0 && currentIndex < checks.length ? checks[currentIndex] : null;
  const showDueDateArrow = activeCheck?.rule === "DUE_DATE";
  const dueDatePos = fieldPositions.find((p) => p.field === "dueDate" && p.page === currentPage);
  const termsPos = fieldPositions.find((p) => p.field === "paymentTerms" && p.page === currentPage);

  function restart() {
    setPlaying(false);
    setCurrentIndex(-1);
    setTimeout(() => setCurrentIndex(0), 50);
  }
  function togglePlay() {
    if (currentIndex >= checks.length - 1) {
      restart();
      setTimeout(() => setPlaying(true), 60);
      return;
    }
    setPlaying((p) => !p);
  }
  function stepNext() {
    setPlaying(false);
    setCurrentIndex((i) => Math.min(checks.length - 1, i + 1));
  }
  function stepPrev() {
    setPlaying(false);
    setCurrentIndex((i) => Math.max(-1, i - 1));
  }

  const visibleBoxes = boxes.filter((b) => fieldPositions.some((p) => p.field === b.field && p.page === currentPage));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto">
        <div
          className="relative mx-auto rounded-lg overflow-auto border border-border bg-secondary"
          style={{ width: PAGE_WIDTH, maxHeight: 660 }}
        >
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-secondary">
              <Loader2 className="size-6 animate-spin text-text-faint" />
            </div>
          )}

          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }} className="relative">
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
                <Page pageNumber={currentPage} width={PAGE_WIDTH} renderAnnotationLayer={false} renderTextLayer={false} />
              </Document>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt="Uploaded invoice" className="block" style={{ width: PAGE_WIDTH }} onLoad={() => setLoaded(true)} />
            )}

            <div className="absolute inset-0">
              {showDueDateArrow && dueDatePos && termsPos && (
                <ArrowConnector from={termsPos} to={dueDatePos} />
              )}
              <AnimatePresence>
                {visibleBoxes.map(({ field, tone, check }) => {
                  const pos = fieldPositions.find((p) => p.field === field && p.page === currentPage)!;
                  const isCircle = CIRCLE_FIELDS.includes(field);
                  const isOpen = activePopover === field;
                  return (
                    <motion.div
                      key={field}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      onMouseEnter={() => setActivePopover(field)}
                      onMouseLeave={() => setActivePopover((f) => (f === field ? null : f))}
                      onClick={() => setActivePopover((f) => (f === field ? null : field))}
                      className={`absolute border-2 cursor-pointer pointer-events-auto ${TONE_RING[tone]} ${isCircle ? "rounded-full" : "rounded-[3px]"}`}
                      style={{
                        left: `${pos.x * 100}%`,
                        top: `${pos.y * 100}%`,
                        width: `${pos.width * 100}%`,
                        height: `${pos.height * 100}%`,
                        zIndex: isOpen ? 20 : 10,
                      }}
                    >
                      {tone !== "active" && (
                        <div
                          className={`absolute -top-2.5 -right-2.5 size-4 rounded-full flex items-center justify-center text-white ${TONE_BADGE[tone]}`}
                        >
                          {tone === "flagged" ? (
                            <X className="size-2.5" strokeWidth={3} />
                          ) : tone === "warning" ? (
                            <AlertTriangle className="size-2.5" strokeWidth={2.5} />
                          ) : (
                            <Check className="size-2.5" strokeWidth={3} />
                          )}
                        </div>
                      )}

                      {isOpen && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-lg border border-border bg-popover shadow-lg p-3 text-left cursor-auto"
                          onMouseEnter={() => setActivePopover(field)}
                          onMouseLeave={() => setActivePopover(null)}
                        >
                          <div className="font-semibold text-[12px] mb-1">{check.label}</div>
                          <div className="text-[11px] text-muted-foreground leading-snug mb-1.5">{check.explanation}</div>
                          {check.expectedValue && (
                            <div className="text-[10.5px] text-text-faint">
                              Expected: <span className="text-foreground font-medium">{check.expectedValue}</span>
                            </div>
                          )}
                          {check.actualValue && (
                            <div className="text-[10.5px] text-text-faint">
                              Actual: <span className="text-foreground font-medium">{check.actualValue}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 px-0.5">
          <div className="flex items-center gap-1">
            <IconButton onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.2).toFixed(2)))} disabled={zoom <= MIN_ZOOM} label="Zoom out">
              <ZoomOut className="size-3.5" />
            </IconButton>
            <span className="text-[11px] text-text-faint w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
            <IconButton onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.2).toFixed(2)))} disabled={zoom >= MAX_ZOOM} label="Zoom in">
              <ZoomIn className="size-3.5" />
            </IconButton>
          </div>

          {numPages > 1 && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-faint">
              <IconButton onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} label="Previous page">
                <ChevronLeft className="size-3.5" />
              </IconButton>
              Page {currentPage}/{numPages}
              <IconButton onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} disabled={currentPage === numPages} label="Next page">
                <ChevronRight className="size-3.5" />
              </IconButton>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        <IconButton onClick={restart} label="Restart">
          <RotateCcw className="size-3.5" />
        </IconButton>
        <IconButton onClick={stepPrev} disabled={currentIndex < 0} label="Previous check">
          <StepBack className="size-3.5" />
        </IconButton>
        <button
          onClick={togglePlay}
          className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/85 transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </button>
        <IconButton onClick={stepNext} disabled={currentIndex >= checks.length - 1} label="Next check">
          <StepForward className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}
