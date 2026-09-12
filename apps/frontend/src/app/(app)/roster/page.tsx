"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, Users, AlertTriangle, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/layout/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useRoster,
  useUploadRoster,
  RosterUploadResult,
  RosterUploadNeedsMapping,
  RosterField,
  REQUIRED_ROSTER_FIELDS,
  ROSTER_FIELD_LABELS,
} from "@/lib/hooks/use-roster";
import { money, initials, initialsColor, fmtDateShort } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { useMonthContext } from "@/lib/hooks/use-month";

export default function RosterPage() {
  const { data: roster, isLoading } = useRoster();
  const { isViewingCurrent } = useMonthContext();
  const upload = useUploadRoster();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [lastResult, setLastResult] = useState<RosterUploadResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [mappingNeeded, setMappingNeeded] = useState<RosterUploadNeedsMapping | null>(null);

  function handleFile(file: File) {
    setLastResult(null);
    setPendingFile(file);
    upload.mutate(
      { file },
      {
        onSuccess: (result) => {
          if (result.needsMapping) {
            setMappingNeeded(result);
            return;
          }
          setLastResult(result);
          if (result.failed > 0) {
            toast.warning(`Loaded ${result.created + result.updated} rows, ${result.failed} couldn't be read.`);
          } else {
            toast.success(`Loaded ${result.created} new and updated ${result.updated} existing consultant${result.created + result.updated === 1 ? "" : "s"}.`);
          }
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Couldn't read that sheet — try again.");
        },
      },
    );
  }

  function submitMapping(mapping: Partial<Record<RosterField, string>>) {
    if (!pendingFile) return;
    upload.mutate(
      { file: pendingFile, mapping },
      {
        onSuccess: (result) => {
          if (result.needsMapping) {
            setMappingNeeded(result);
            return;
          }
          setMappingNeeded(null);
          setLastResult(result);
          if (result.failed > 0) {
            toast.warning(`Loaded ${result.created + result.updated} rows, ${result.failed} couldn't be read.`);
          } else {
            toast.success(`Loaded ${result.created} new and updated ${result.updated} existing consultant${result.created + result.updated === 1 ? "" : "s"}.`);
          }
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Couldn't read that sheet — try again.");
        },
      },
    );
  }

  const failedRows = lastResult?.results.filter((r) => !r.ok) ?? [];

  return (
    <>
      <Topbar />
      <PageContent>
        <div className="mb-5">
          <div className="font-display font-semibold text-[15.5px]">Consultant Roster</div>
          <div className="text-[12.5px] text-muted-foreground">
            The approved hours, rates, and weeks Audix checks every invoice against. Upload a CSV or Excel sheet
            to load or update it — no QuickBooks or Ceipal connection needed yet.
          </div>
        </div>

        {!isViewingCurrent ? (
          <Card className="mb-[18px]">
            <CardContent className="py-6 flex items-center gap-2.5 text-[12.5px] text-text-faint">
              <Lock className="size-4" />
              You&apos;re viewing a historical month's roster (read-only). Switch to the current month to upload changes.
            </CardContent>
          </Card>
        ) : (
        <Card className="mb-[18px]">
          <CardContent className="p-0">
            <div
              onClick={() => !upload.isPending && fileInputRef.current?.click()}
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
              className={`m-5 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragActive ? "border-primary bg-brand-soft" : "border-border-strong hover:bg-secondary"
              }`}
            >
              <div className="size-11 rounded-2xl bg-brand-soft text-primary flex items-center justify-center mx-auto mb-3">
                {upload.isPending ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
              </div>
              <div className="font-semibold text-[13.5px] mb-1">
                {upload.isPending ? "Reading sheet…" : "Drop your hours sheet here, or click to browse"}
              </div>
              <div className="text-[12px] text-text-faint">
                Any CSV or Excel format — Audix matches columns by meaning, not exact headers
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </CardContent>
        </Card>
        )}

        {failedRows.length > 0 && (
          <Card className="mb-[18px] border-warning/40 bg-warning-soft">
            <CardContent className="p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-[13px] text-warning">
                    {failedRows.length} row{failedRows.length > 1 ? "s" : ""} couldn't be loaded
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5 mb-2">
                    Each one is missing a name, approved hours, or a pay rate in the sheet itself — fill in
                    that cell and re-upload to add them.
                  </div>
                  <ul className="text-[12.5px] space-y-1">
                    {failedRows.map((r, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="font-medium">{r.employeeName}</span>
                        <span className="text-text-faint">{r.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => setLastResult(null)}
                  className="text-text-faint hover:text-foreground shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="size-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <div className="p-5 pb-3.5 border-b border-border">
            <div className="font-display font-semibold text-[15.5px]">Loaded Consultants</div>
            <div className="text-[12.5px] text-muted-foreground">{roster?.length ?? 0} entries on file</div>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (roster ?? []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="size-9 mx-auto mb-3 text-text-faint" />
              No consultants loaded yet — upload a sheet above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Approved Hours</TableHead>
                  <TableHead>Pay Rate</TableHead>
                  <TableHead>Bill Rate</TableHead>
                  <TableHead>Approved Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(roster ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="size-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ background: initialsColor(r.employeeName) }}
                        >
                          {initials(r.employeeName)}
                        </div>
                        <span className="font-semibold">{r.employeeName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-faint">{r.project ?? "—"}</TableCell>
                    <TableCell className="text-text-faint">
                      {r.weekStart ? `${fmtDateShort(r.weekStart)} – ${r.weekEnd ? fmtDateShort(r.weekEnd) : "—"}` : "—"}
                    </TableCell>
                    <TableCell>{r.country}</TableCell>
                    <TableCell className="font-mono">{r.hours} hrs</TableCell>
                    <TableCell className="font-mono">${r.hourlyRate}/hr</TableCell>
                    <TableCell className="font-mono">{r.billRate !== null ? `$${r.billRate}/hr` : "—"}</TableCell>
                    <TableCell className="font-mono">{money(r.hours * r.hourlyRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContent>

      <MappingDialog
        needsMapping={mappingNeeded}
        onOpenChange={(open) => !open && setMappingNeeded(null)}
        onSubmit={submitMapping}
        isPending={upload.isPending}
      />
    </>
  );
}

function MappingDialog({
  needsMapping,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  needsMapping: RosterUploadNeedsMapping | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (mapping: Partial<Record<RosterField, string>>) => void;
  isPending: boolean;
}) {
  const [choices, setChoices] = useState<Partial<Record<RosterField, string>>>({});

  if (!needsMapping) return null;

  const current = { ...needsMapping.detectedMapping, ...choices };
  const canSubmit = REQUIRED_ROSTER_FIELDS.every((f) => !!current[f]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Match your columns</DialogTitle>
          <DialogDescription>
            Audix couldn't confidently identify every required column in this sheet. Pick which column holds
            each field below — the rest were matched automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {REQUIRED_ROSTER_FIELDS.map((field) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">
                {ROSTER_FIELD_LABELS[field]}
                {needsMapping.missingFields.includes(field) && <span className="text-danger"> — not found</span>}
              </Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={current[field] ?? ""}
                onChange={(e) => setChoices((prev) => ({ ...prev, [field]: e.target.value || undefined }))}
              >
                <option value="">Select a column…</option>
                {needsMapping.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || isPending} onClick={() => onSubmit(current)}>
            {isPending ? "Uploading…" : "Continue Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
