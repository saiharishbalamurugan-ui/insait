"use client";

import { useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PRESETS: { label: string; days: number }[] = [
  { label: "Due on Receipt", days: 0 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 45", days: 45 },
  { label: "Net 60", days: 60 },
  { label: "Net 90", days: 90 },
];

export function PaymentTermsPicker({
  fileName,
  isPending,
  onSubmit,
}: {
  fileName: string;
  isPending: boolean;
  onSubmit: (label: string, days: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState("");
  const usingCustom = selected === null && customDays !== "";

  const canContinue = selected !== null || (customDays !== "" && Number(customDays) >= 0);

  function handleContinue() {
    if (selected !== null) {
      const preset = PRESETS.find((p) => p.days === selected)!;
      onSubmit(preset.label, preset.days);
    } else if (customDays !== "") {
      const days = Number(customDays);
      onSubmit(`Net ${days}`, days);
    }
  }

  return (
    <Card>
      <CardContent className="text-center py-10 px-6">
        <div className="size-14 rounded-2xl bg-warning-soft text-warning flex items-center justify-center mx-auto mb-4">
          <Receipt className="size-6" />
        </div>
        <div className="font-display font-semibold text-[15px] mb-1">Couldn't detect payment terms</div>
        <div className="text-[12.5px] text-text-faint max-w-sm mx-auto mb-6">
          {fileName} doesn't state Net 15/30/45/60/90 or "Due on Receipt" anywhere Audix could find. Pick the terms
          for this vendor so the due-date check can run.
        </div>

        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setSelected(p.days);
                setCustomDays("");
              }}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-[12.5px] font-semibold transition-colors",
                selected === p.days
                  ? "border-primary bg-brand-soft text-primary"
                  : "border-border-strong bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="max-w-[220px] mx-auto text-left mb-6">
          <Label className="text-[11px] text-text-faint font-semibold mb-1.5 block">Or a custom number of days</Label>
          <Input
            type="number"
            min={0}
            placeholder="e.g. 21"
            value={customDays}
            onChange={(e) => {
              setCustomDays(e.target.value);
              setSelected(null);
            }}
            className={usingCustom ? "border-primary" : ""}
          />
        </div>

        <Button className="gap-1.5" disabled={!canContinue || isPending} onClick={handleContinue}>
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}
