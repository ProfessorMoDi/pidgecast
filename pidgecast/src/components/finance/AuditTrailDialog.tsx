"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { Separator } from "@/components/ui/separator";
import { SCENARIO_CONFIG } from "@/lib/config";
import type { ForecastWeek } from "@/lib/types";

interface AuditTrailDialogProps {
  week: ForecastWeek | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditTrailDialog({
  week,
  open,
  onOpenChange,
}: AuditTrailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-lg">
        {week && (
          <>
            <DialogHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-base">
                  Audit trail — {week.weekLabel}
                </DialogTitle>
                <RiskBadge level={week.riskLevel} />
              </div>
              <DialogDescription className="text-pretty">
                How the forecast number was produced. Scenario:{" "}
                <span className="font-medium text-foreground">
                  {SCENARIO_CONFIG[week.scenario].label}
                </span>
                . A number that cannot be explained cannot be defended in a
                board meeting.
              </DialogDescription>
            </DialogHeader>

            <Separator className="my-4" />

            <ol className="space-y-3">
              {week.auditTrail.map((step) => (
                <li key={step.label} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="font-mono text-sm tabular-nums text-foreground">
                      {step.value}
                    </span>
                  </div>
                  {step.detail && (
                    <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                      {step.detail}
                    </p>
                  )}
                </li>
              ))}
            </ol>

            <Separator className="my-4" />

            <p className="text-xs text-muted-foreground text-pretty">
              Accrual basis: Pidgecast forecasts recognized revenue timing, not
              cash collection. Covenant headroom is measured against a
              configurable demo revenue floor.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
