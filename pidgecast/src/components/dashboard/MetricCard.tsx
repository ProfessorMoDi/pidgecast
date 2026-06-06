import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "default" | "positive" | "negative" | "warning";
  className?: string;
  footer?: ReactNode;
}

const ACCENT_VALUE: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "text-foreground",
  positive: "text-[var(--risk-healthy)]",
  negative: "text-[var(--risk-critical)]",
  warning: "text-[var(--risk-at-risk)]",
};

const ACCENT_ICON: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "bg-[var(--brand-soft)] text-[var(--brand)]",
  positive: "bg-[var(--risk-healthy)]/12 text-[var(--risk-healthy)]",
  negative: "bg-[var(--risk-critical)]/12 text-[var(--risk-critical)]",
  warning: "bg-[var(--risk-at-risk)]/12 text-[var(--risk-at-risk)]",
};

const ACCENT_BAR: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "bg-[var(--brand)]",
  positive: "bg-[var(--risk-healthy)]",
  negative: "bg-[var(--risk-critical)]",
  warning: "bg-[var(--risk-at-risk)]",
};

export function MetricCard({
  label,
  value,
  sublabel,
  hint,
  icon,
  accent = "default",
  className,
  footer,
}: MetricCardProps) {
  return (
    <Card className={cn("group/metric relative gap-0 py-0 lift", className)}>
      {/* Left accent bar reveals on hover for a tactile, alive feel. */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 origin-top scale-y-0 rounded-l-xl transition-transform duration-200 group-hover/metric:scale-y-100",
          ACCENT_BAR[accent]
        )}
        aria-hidden="true"
      />
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            {icon && (
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-transform duration-200 group-hover/metric:scale-110",
                  ACCENT_ICON[accent]
                )}
              >
                {icon}
              </span>
            )}
            {hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/70 transition-colors hover:text-foreground"
                    aria-label="More information"
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-pretty">
                  {hint}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums tracking-tight",
            ACCENT_VALUE[accent]
          )}
        >
          {value}
        </div>
        {sublabel && (
          <div className="text-sm text-muted-foreground">{sublabel}</div>
        )}
        {footer && <div className="mt-1">{footer}</div>}
      </CardContent>
    </Card>
  );
}
