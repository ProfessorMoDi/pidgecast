import { cn } from "@/lib/utils";
import { RISK_CONFIG } from "@/lib/config";
import type { RiskLevel } from "@/lib/types";

const STYLES: Record<RiskLevel, string> = {
  healthy:
    "border-[var(--risk-healthy)]/30 bg-[var(--risk-healthy)]/10 text-[var(--risk-healthy)]",
  watch:
    "border-[var(--risk-watch)]/35 bg-[var(--risk-watch)]/12 text-[var(--risk-watch)]",
  "at-risk":
    "border-[var(--risk-at-risk)]/35 bg-[var(--risk-at-risk)]/12 text-[var(--risk-at-risk)]",
  critical:
    "border-[var(--risk-critical)]/40 bg-[var(--risk-critical)]/12 text-[var(--risk-critical)]",
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
  showDot?: boolean;
}

export function RiskBadge({ level, className, showDot = true }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        STYLES[level],
        className
      )}
    >
      {showDot && (
        <span
          className="size-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {RISK_CONFIG[level].label}
    </span>
  );
}
