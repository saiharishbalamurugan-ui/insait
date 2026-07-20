"use client";

import { useState } from "react";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useMonthContext, useCreateMonth, useClearMonthData } from "@/lib/hooks/use-month";

function formatLabel(label: string) {
  const [year, month] = label.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function MonthSelector() {
  const { selectedMonth, setSelectedMonth, isViewingCurrent, months } = useMonthContext();
  const createMonth = useCreateMonth();
  const clearMonth = useClearMonthData();
  const [newMonthOpen, setNewMonthOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

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
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={newMonthOpen}
        onOpenChange={setNewMonthOpen}
        title="Start a new month?"
        description="This creates a fresh, empty workspace for the next month. All current data stays exactly as-is and becomes read-only history — nothing is deleted."
        confirmLabel="Create New Month"
        isPending={createMonth.isPending}
        onConfirm={() =>
          createMonth.mutate(undefined, {
            onSuccess: (month) => {
              setSelectedMonth(month.label);
              toast.success(`${formatLabel(month.label)} started`);
              setNewMonthOpen(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't create a new month."),
          })
        }
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={`Clear ${formatLabel(selectedMonth)}?`}
        description="This permanently deletes every invoice, audit report, and roster entry uploaded for this month. Historical months are not affected. This cannot be undone."
        confirmLabel="Delete Everything in This Month"
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
    </>
  );
}
