import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

interface InsightPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "warning" | "critical";
}

const TONE: Record<NonNullable<InsightPanelProps["tone"]>, string> = {
  neutral: "border-l-primary",
  warning: "border-l-[var(--risk-at-risk)]",
  critical: "border-l-[var(--risk-critical)]",
};

export function InsightPanel({
  title = "Forecast insight",
  children,
  className,
  tone = "neutral",
}: InsightPanelProps) {
  return (
    <Card className={cn("border-l-4 py-0", TONE[tone], className)}>
      <CardContent className="flex gap-3 p-4">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <div className="text-sm leading-relaxed text-foreground text-pretty">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
