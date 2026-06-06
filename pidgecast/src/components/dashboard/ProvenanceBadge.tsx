import { cn } from "@/lib/utils";
import { BadgeCheck, FlaskConical, Ruler } from "lucide-react";
import type { Provenance } from "@/lib/regression-findings";

const META: Record<
  Provenance,
  { label: string; className: string; icon: typeof BadgeCheck }
> = {
  measured: {
    label: "Measured",
    className:
      "border-[var(--risk-healthy)]/35 bg-[var(--risk-healthy)]/12 text-[var(--risk-healthy)]",
    icon: BadgeCheck,
  },
  user_range: {
    label: "Stated range",
    className:
      "border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/12 text-[var(--accent-cyan)]",
    icon: Ruler,
  },
  illustrative: {
    label: "Illustrative",
    className:
      "border-[var(--risk-watch)]/40 bg-[var(--risk-watch)]/12 text-[var(--risk-watch)]",
    icon: FlaskConical,
  },
};

interface ProvenanceBadgeProps {
  provenance: Provenance;
  label?: string;
  className?: string;
}

export function ProvenanceBadge({
  provenance,
  label,
  className,
}: ProvenanceBadgeProps) {
  const meta = META[provenance];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        meta.className,
        className
      )}
    >
      <Icon className="size-3" />
      {label ?? meta.label}
    </span>
  );
}
