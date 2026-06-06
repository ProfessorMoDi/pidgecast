import { cn, formatWeekday, formatDateShort } from "@/lib/utils";
import { CONDITION_LABEL } from "@/lib/weather";
import {
  Snowflake,
  CloudRain,
  Wind,
  Sun,
  Thermometer,
  CheckCircle2,
  Droplets,
} from "lucide-react";
import type { WeatherCondition, WeatherDay } from "@/lib/types";

const CONDITION_META: Record<
  WeatherCondition,
  { icon: typeof Snowflake; className: string; action: string }
> = {
  frost: {
    icon: Snowflake,
    className:
      "border-[var(--risk-critical)]/40 bg-[var(--risk-critical)]/10 text-[var(--risk-critical)]",
    action: "Hard stop — no membrane or adhesive work.",
  },
  rain: {
    icon: CloudRain,
    className:
      "border-[var(--risk-at-risk)]/35 bg-[var(--risk-at-risk)]/10 text-[var(--risk-at-risk)]",
    action: "Wet deck — limit to covered or prep work.",
  },
  "high-wind": {
    icon: Wind,
    className:
      "border-[var(--risk-at-risk)]/35 bg-[var(--risk-at-risk)]/10 text-[var(--risk-at-risk)]",
    action: "Restrict lifting and sheet handling at height.",
  },
  heat: {
    icon: Sun,
    className:
      "border-[var(--risk-watch)]/35 bg-[var(--risk-watch)]/10 text-[var(--risk-watch)]",
    action: "Shift bitumen work to cooler hours.",
  },
  cold: {
    icon: Thermometer,
    className:
      "border-[var(--risk-watch)]/35 bg-[var(--risk-watch)]/10 text-[var(--risk-watch)]",
    action: "Check adhesive cure times; plan around cold.",
  },
  normal: {
    icon: CheckCircle2,
    className:
      "border-[var(--risk-healthy)]/30 bg-[var(--risk-healthy)]/10 text-[var(--risk-healthy)]",
    action: "Full crew capacity available.",
  },
};

interface WeatherDayCardProps {
  day: WeatherDay;
}

export function WeatherDayCard({ day }: WeatherDayCardProps) {
  const meta = CONDITION_META[day.condition];
  const Icon = meta.icon;
  const capacityPct = Math.round(day.capacity * 100);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3",
        !day.isWorkday && "opacity-60"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{formatWeekday(day.date)}</div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatDateShort(day.date)}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
            meta.className
          )}
        >
          <Icon className="size-3" />
          {CONDITION_LABEL[day.condition]}
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Capacity</span>
        <span
          className={cn(
            "font-mono text-lg font-semibold tabular-nums",
            capacityPct === 0
              ? "text-[var(--risk-critical)]"
              : capacityPct < 60
                ? "text-[var(--risk-at-risk)]"
                : capacityPct < 100
                  ? "text-[var(--risk-watch)]"
                  : "text-[var(--risk-healthy)]"
          )}
        >
          {capacityPct}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Thermometer className="size-3" />
          {Math.round(day.tempMinC)}–{Math.round(day.tempMaxC)}°
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="size-3" />
          {day.precipitationMm.toFixed(1)}mm
        </span>
        <span className="flex items-center gap-1">
          <Wind className="size-3" />
          {Math.round(day.windMaxKmh)}
        </span>
      </div>

      <p className="border-t pt-2 text-[11px] leading-snug text-muted-foreground text-pretty">
        {day.isWorkday ? meta.action : "Weekend — not counted in workable days."}
      </p>
    </div>
  );
}
