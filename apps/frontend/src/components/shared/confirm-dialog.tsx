"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  requireText,
  isPending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** If set, the confirm button stays disabled until the user types this exact text. */
  requireText?: string;
  isPending?: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const locked = requireText !== undefined && typed !== requireText;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTyped("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-2.5">
            {destructive && (
              <div className="size-8 rounded-full bg-danger-soft text-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="size-4" />
              </div>
            )}
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {requireText !== undefined && (
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">{requireText}</span> to confirm
            </Label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={locked || isPending}
            onClick={onConfirm}
          >
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
