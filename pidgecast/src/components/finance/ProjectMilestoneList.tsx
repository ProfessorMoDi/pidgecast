import { Progress } from "@/components/ui/progress";
import { cn, formatEur, formatDateShort } from "@/lib/utils";
import { CloudRain, TriangleAlert } from "lucide-react";
import type { MilestoneStatus, ProjectMilestone } from "@/lib/types";

const STATUS_STYLE: Record<
  MilestoneStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-muted text-muted-foreground",
  },
  "in-progress": {
    label: "In progress",
    className:
      "bg-[var(--stream-project)]/10 text-[var(--stream-project)]",
  },
  "at-risk": {
    label: "At risk",
    className:
      "bg-[var(--risk-at-risk)]/12 text-[var(--risk-at-risk)]",
  },
  delayed: {
    label: "Delayed",
    className:
      "bg-[var(--risk-critical)]/12 text-[var(--risk-critical)]",
  },
};

const SENSITIVITY_LABEL: Record<ProjectMilestone["weatherSensitivity"], string> =
  {
    low: "Low weather sensitivity",
    medium: "Medium weather sensitivity",
    high: "High weather sensitivity",
  };

interface ProjectMilestoneListProps {
  milestones: ProjectMilestone[];
}

export function ProjectMilestoneList({
  milestones,
}: ProjectMilestoneListProps) {
  return (
    <ul className="divide-y">
      {milestones.map((m) => {
        const s = STATUS_STYLE[m.status];
        const weatherSensitive = m.weatherSensitivity !== "low";
        return (
          <li key={m.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {m.projectName}
                  </span>
                  {m.status === "at-risk" || m.status === "delayed" ? (
                    <TriangleAlert className="size-3.5 shrink-0 text-[var(--risk-at-risk)]" />
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {m.milestone}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-medium tabular-nums">
                  {formatEur(m.billingAmount)}
                </div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDateShort(m.expectedDate)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Progress value={m.progress} className="h-1.5 flex-1" />
              <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {m.progress}%
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
                  s.className
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px]",
                  weatherSensitive
                    ? "text-[var(--stream-project)]"
                    : "text-muted-foreground"
                )}
              >
                {weatherSensitive && <CloudRain className="size-3" />}
                {SENSITIVITY_LABEL[m.weatherSensitivity]}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
