"use client";

import { useEffect, useState } from "react";
import { Calendar, ChevronDown, Plus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useMonthContext, useCreateMonth, useClearMonthData, useDeleteMonth } from "@/lib/hooks/use-month";
import { fmtMonthLabel as formatLabel } from "@/lib/format";

function nextLabel(label: string): string {
  const [year, month] = label.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1)); // month is 1-indexed in the label, so this lands on the 1st of next month
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthSelector() {
  const { selectedMonth, setSelectedMonth, currentMonthLabel, isViewingCurrent, months } = useMonthContext();
  const createMonth = useCreateMonth();
  const clearMonth = useClearMonthData();
  const deleteMonth = useDeleteMonth();
  const [newMonthOpen, setNewMonthOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!selectedMonth) return null;

  const sorted = [...months].sort((a, b) => b.label.localeCompare(a.label));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="gap-1.5 font-medium">
              <Calendar className="size-3.5" />
              {formatLabel(selectedMonth)}
              {!isViewingCurrent && <Lock className="size-3 text-text-faint" />}
              <ChevronDown className="size-3.5 text-text-faint" />
            </Button>
          }
        />
        <DropdownMenuContent className="w-56">
          {sorted.map((m) => (
            <DropdownMenuItem key={m.label} onClick={() => setSelectedMonth(m.label)}>
              <span className="flex-1">{formatLabel(m.label)}</span>
              {m.isCurrent ? (
                <span className="text-[10px] font-semibold text-primary">CURRENT</span>
              ) : (
                <Lock className="size-3 text-text-faint" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setNewMonthOpen(true)}>
            <Plus className="size-3.5" /> New Month
          </DropdownMenuItem>
          {isViewingCurrent && (
            <DropdownMenuItem variant="destructive" onClick={() => setClearOpen(true)}>
              <Trash2 className="size-3.5" /> Clear Current Month
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" /> Delete This Month
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewMonthDialog
        open={newMonthOpen}
        onOpenChange={setNewMonthOpen}
        defaultLabel={nextLabel(currentMonthLabel ?? selectedMonth)}
        isPending={createMonth.isPending}
        onSubmit={(label) =>
          createMonth.mutate(label, {
            onSuccess: (month) => {
              setSelectedMonth(month.label);
              toast.success(`${formatLabel(month.label)} started`);
              setNewMonthOpen(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't create that month."),
          })
        }
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={`Clear ${formatLabel(selectedMonth)}?`}
        description="This empties every invoice, audit report, and roster entry uploaded for this month, but keeps the month itself so you can keep using it. Other months are not affected. This cannot be undone."
        confirmLabel="Clear This Month"
        destructive
        requireText={selectedMonth}
        isPending={clearMonth.isPending}
        onConfirm={() =>
          clearMonth.mutate(selectedMonth, {
            onSuccess: (result) => {
              toast.success(`Cleared ${result.clearedInvoices} invoices and ${result.clearedRosterRows} roster rows.`);
              setClearOpen(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't clear this month."),
          })
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${formatLabel(selectedMonth)}?`}
        description="This permanently removes this month's workspace and every invoice, audit report, and roster entry in it. Other months are not affected. This cannot be undone."
        confirmLabel="Delete This Month"
        destructive
        requireText={selectedMonth}
        isPending={deleteMonth.isPending}
        onConfirm={() =>
          deleteMonth.mutate(selectedMonth, {
            onSuccess: (result) => {
              toast.success(`Deleted ${formatLabel(selectedMonth)} (${result.deletedInvoices} invoices, ${result.deletedRosterRows} roster rows).`);
              setDeleteOpen(false);
              const fallback = result.newCurrentLabel ?? currentMonthLabel;
              if (fallback) setSelectedMonth(fallback);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete this month."),
          })
        }
      />
    </>
  );
}

function NewMonthDialog({
  open,
  onOpenChange,
  defaultLabel,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLabel: string;
  onSubmit: (label: string) => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(defaultLabel);

  useEffect(() => {
    if (open) setLabel(defaultLabel);
  }, [open, defaultLabel]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new month</DialogTitle>
          <DialogDescription>
            Pick which month to open as a fresh, editable workspace. Whatever's current now becomes read-only
            history — nothing is deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-[12px] text-muted-foreground">Month</Label>
          <Input type="month" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!label || isPending} onClick={() => onSubmit(label)}>
            {isPending ? "Creating…" : "Create Month"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
