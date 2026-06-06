import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CloudOff, RefreshCw, Satellite } from "lucide-react";
import type { WeatherState } from "@/lib/types";

interface WeatherStatusBadgeProps {
  weather: WeatherState;
}

export function WeatherStatusBadge({ weather }: WeatherStatusBadgeProps) {
  if (weather.isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <RefreshCw className="size-3.5 animate-spin" />
        Fetching weather
      </span>
    );
  }

  const live = !weather.isFallback;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-default items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
            live
              ? "border-[var(--risk-healthy)]/30 bg-[var(--risk-healthy)]/10 text-[var(--risk-healthy)]"
              : "border-[var(--risk-watch)]/35 bg-[var(--risk-watch)]/12 text-[var(--risk-watch)]"
          )}
        >
          {live ? (
            <Satellite className="size-3.5" />
          ) : (
            <CloudOff className="size-3.5" />
          )}
          {live ? "Live weather · Open-Meteo" : "Fallback weather"}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">
        {live
          ? "Daily weather is fetched live from Open-Meteo and translated into executable crew capacity."
          : `Live weather unavailable (${weather.error ?? "request failed"}). Using synthetic fallback so the forecast still renders.`}
      </TooltipContent>
    </Tooltip>
  );
}
