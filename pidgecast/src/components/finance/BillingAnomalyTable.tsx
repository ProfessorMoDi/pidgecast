import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatEur, formatDateShort } from "@/lib/utils";
import type { AnomalyStatus, BillingAnomaly } from "@/lib/types";

const STATUS_STYLE: Record<AnomalyStatus, { label: string; className: string }> =
  {
    "on-track": {
      label: "On track",
      className:
        "border-[var(--risk-healthy)]/30 bg-[var(--risk-healthy)]/10 text-[var(--risk-healthy)]",
    },
    watch: {
      label: "Watch",
      className:
        "border-[var(--risk-watch)]/35 bg-[var(--risk-watch)]/12 text-[var(--risk-watch)]",
    },
    missing: {
      label: "Missing",
      className:
        "border-[var(--risk-at-risk)]/35 bg-[var(--risk-at-risk)]/12 text-[var(--risk-at-risk)]",
    },
    escalate: {
      label: "Escalate",
      className:
        "border-[var(--risk-critical)]/40 bg-[var(--risk-critical)]/12 text-[var(--risk-critical)]",
    },
  };

interface BillingAnomalyTableProps {
  anomalies: BillingAnomaly[];
}

export function BillingAnomalyTable({ anomalies }: BillingAnomalyTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Expected billing</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Recommended action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anomalies.map((a) => {
            const s = STATUS_STYLE[a.status];
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.label}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatEur(a.expectedAmount)}
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDateShort(a.expectedDate)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                      s.className
                    )}
                  >
                    {s.label}
                  </span>
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="line-clamp-2 cursor-default text-xs text-muted-foreground">
                        {a.recommendedAction}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-pretty">
                      {a.recommendedAction}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
