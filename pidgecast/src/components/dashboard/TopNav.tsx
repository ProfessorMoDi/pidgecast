"use client";

import { WeatherStatusBadge } from "@/components/weather/WeatherStatusBadge";
import type { WeatherState } from "@/lib/types";
import { Hexagon } from "lucide-react";

interface TopNavProps {
  weather: WeatherState;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TopNav({ weather }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card/85 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-foreground)] shadow-md ring-1 ring-[var(--brand)]/30 transition-transform duration-200 hover:scale-105">
            <Hexagon className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                Pidgecast
              </span>
              <span className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand)]">
                Demo
              </span>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Weather-aware revenue forecasting for roofing operators and
              portfolio finance teams.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Last updated
            </div>
            <div className="font-mono text-xs tabular-nums text-foreground">
              {formatTimestamp(weather.lastUpdated)}
            </div>
          </div>
          <WeatherStatusBadge weather={weather} />
        </div>
      </div>
    </header>
  );
}
