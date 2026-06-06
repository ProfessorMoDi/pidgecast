"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { AuditTrailDialog } from "@/components/finance/AuditTrailDialog";
import { cn, formatEur, formatPct } from "@/lib/utils";
import { Search } from "lucide-react";
import type { ForecastWeek } from "@/lib/types";

interface ForecastTableProps {
  weeks: ForecastWeek[];
  /** When true, clicking a row opens the audit trail (CFO view). */
  enableAudit?: boolean;
}

export function ForecastTable({ weeks, enableAudit = true }: ForecastTableProps) {
  const [selected, setSelected] = useState<ForecastWeek | null>(null);
  const [open, setOpen] = useState(false);

  function openAudit(week: ForecastWeek) {
    if (!enableAudit) return;
    setSelected(week);
    setOpen(true);
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Recurring</TableHead>
              <TableHead className="text-right">Project billing</TableHead>
              <TableHead className="text-right">Forecast</TableHead>
              <TableHead className="text-right">Weather</TableHead>
              <TableHead className="text-right">Headroom</TableHead>
              <TableHead className="text-right">Risk</TableHead>
              {enableAudit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeks.map((w) => (
              <TableRow
                key={w.weekIndex}
                onClick={() => openAudit(w)}
                className={cn(
                  enableAudit && "cursor-pointer",
                  "group"
                )}
              >
                <TableCell className="font-medium">{w.weekLabel}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatEur(w.recurringRevenue)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatEur(w.projectBillingRevenue)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium tabular-nums">
                  {formatEur(w.forecastRevenue)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums",
                    w.weatherImpactPct < 0
                      ? "text-[var(--risk-at-risk)]"
                      : "text-muted-foreground"
                  )}
                >
                  {formatPct(w.weatherImpactPct)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono tabular-nums",
                    w.covenantHeadroom < 0
                      ? "text-[var(--risk-critical)]"
                      : "text-foreground"
                  )}
                >
                  {formatEur(w.covenantHeadroom)}
                </TableCell>
                <TableCell className="text-right">
                  <RiskBadge level={w.riskLevel} />
                </TableCell>
                {enableAudit && (
                  <TableCell className="text-right">
                    <Search className="ml-auto size-3.5 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {enableAudit && (
        <>
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            Click any week to open its audit trail.
          </p>
          <AuditTrailDialog
            week={selected}
            open={open}
            onOpenChange={setOpen}
          />
        </>
      )}
    </>
  );
}
