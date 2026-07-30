"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={`text-text-faint hover:text-foreground align-middle ${className ?? ""}`}
            aria-label="More info"
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-[12px] leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}
