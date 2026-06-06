import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COVENANT_REVENUE_FLOOR_EUR } from "@/lib/config";
import { cn, formatEur } from "@/lib/utils";
import { Info, ShieldCheck } from "lucide-react";
import type { ForecastSummary } from "@/lib/forecast";

interface CovenantHeadroomCardProps {
  summary: ForecastSummary;
  /** Use the worst (min) week headroom rather than total. */
  className?: string;
}

export function CovenantHeadroomCard({
  summary,
  className,
}: CovenantHeadroomCardProps) {
  const headroom = summary.minCovenantHeadroom;
  const positive = headroom >= 0;
  // Express headroom as a % of the floor, capped for the bar.
  const ratio = Math.max(
    0,
    Math.min(100, (headroom / COVENANT_REVENUE_FLOOR_EUR) * 100)
  );

  return (
    <Card className={cn("py-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-5 pt-5 pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Covenant headroom
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="About covenant headroom">
                <Info className="size-3.5 text-muted-foreground/70" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-pretty">
              Lowest weekly forecast revenue minus the configurable demo
              covenant floor of {formatEur(COVENANT_REVENUE_FLOOR_EUR)}. This is
              a deliberately simple proxy, not a leverage-ratio covenant.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <RiskBadge level={summary.worstRisk} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-5">
        <div
          className={cn(
            "font-mono text-3xl font-semibold tabular-nums tracking-tight",
            positive ? "text-[var(--risk-healthy)]" : "text-[var(--risk-critical)]"
          )}
        >
          {formatEur(headroom)}
        </div>
        <Progress value={ratio} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Floor {formatEur(COVENANT_REVENUE_FLOOR_EUR)}</span>
          <span>
            Worst week:{" "}
            <span className="font-medium text-foreground">
              {summary.worstWeek?.weekLabel ?? "—"}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
