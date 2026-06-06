"use client";

import { useMemo, useState } from "react";
import { TopNav } from "@/components/dashboard/TopNav";
import { RoleSwitcher } from "@/components/dashboard/RoleSwitcher";
import { ScenarioSelector } from "@/components/dashboard/ScenarioSelector";
import { OpcoSelector } from "@/components/dashboard/OpcoSelector";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { PEBoardView } from "@/components/views/PEBoardView";
import { CFOView } from "@/components/views/CFOView";
import { OpcoMDView } from "@/components/views/OpcoMDView";
import { ProjectLeadView } from "@/components/views/ProjectLeadView";
import { RegressionAnalysisView } from "@/components/views/RegressionAnalysisView";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWeather } from "@/hooks/use-weather";
import { computeForecastWeeks, summariseForecast } from "@/lib/forecast";
import {
  getAnomalies,
  getForecastWeeks,
  getOpco,
  getProjects,
  OPCOS,
} from "@/lib/mock-data";
import { ROLE_CONFIG, SCENARIO_CONFIG, SCENARIOS } from "@/lib/config";
import type { Role, Scenario } from "@/lib/types";
import type { ForecastSummary } from "@/lib/forecast";
import type { ForecastWeek } from "@/lib/types";
import type { DashboardViewModel } from "@/components/views/view-model";
import { Building2, CloudOff, HelpCircle, SlidersHorizontal } from "lucide-react";

export function DashboardShell() {
  const [role, setRole] = useState<Role>("regression");
  const [scenario, setScenario] = useState<Scenario>("base");
  const [opcoId, setOpcoId] = useState<string>(OPCOS[0].id);

  const opco = useMemo(() => getOpco(opcoId), [opcoId]);
  const weather = useWeather(opco);

  const model: DashboardViewModel = useMemo(() => {
    const inputs = getForecastWeeks(opcoId);
    const projects = getProjects(opcoId);
    const anomalies = getAnomalies(opcoId);

    const scenarioWeeks = {} as Record<Scenario, ForecastWeek[]>;
    const scenarioSummaries = {} as Record<Scenario, ForecastSummary>;
    for (const s of SCENARIOS) {
      const w = computeForecastWeeks(inputs, weather.days, s);
      scenarioWeeks[s] = w;
      scenarioSummaries[s] = summariseForecast(w);
    }

    return {
      opco,
      scenario,
      weeks: scenarioWeeks[scenario],
      summary: scenarioSummaries[scenario],
      scenarioSummaries,
      scenarioWeeks,
      weatherDays: weather.days,
      weatherHours: weather.hours,
      isFallbackWeather: weather.isFallback,
      projects,
      anomalies,
    };
  }, [opcoId, opco, scenario, weather.days, weather.hours, weather.isFallback]);

  return (
    <div className="flex min-h-full flex-col">
      <TopNav weather={weather} />

      {/* Control bar */}
      <div className="border-b bg-card/50">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <RoleSwitcher value={role} onChange={setRole} />
          <div className="flex flex-wrap items-end gap-3">
            <ScenarioSelector value={scenario} onChange={setScenario} />
            <OpcoSelector value={opcoId} onChange={setOpcoId} />
          </div>
        </div>
      </div>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
          {/* Page heading: active role context */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {ROLE_CONFIG[role].label}
                <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                  {ROLE_CONFIG[role].tagline}
                </span>
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <HelpCircle className="size-3.5 shrink-0" />
                {ROLE_CONFIG[role].question}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Building2 className="size-3.5" />
                {opco.name}
                <span className="text-muted-foreground/70">· {opco.location}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <SlidersHorizontal className="size-3.5" />
                {SCENARIO_CONFIG[scenario].label} scenario
              </span>
            </div>
          </div>

          {weather.isFallback && !weather.isLoading && (
            <Alert className="border-[var(--risk-watch)]/40 bg-[var(--risk-watch)]/5">
              <CloudOff className="size-4" />
              <AlertTitle>Using fallback weather</AlertTitle>
              <AlertDescription>
                Live Open-Meteo data could not be reached
                {weather.error ? ` (${weather.error})` : ""}. The forecast is
                running on synthetic fallback weather so the demo still renders.
                Values update automatically once live data is available.
              </AlertDescription>
            </Alert>
          )}

          {weather.isLoading && role !== "regression" ? (
            <DashboardSkeleton />
          ) : (
            <>
              {role === "regression" && (
                <RegressionAnalysisView
                  model={model}
                  onContinue={() => setRole("cfo")}
                />
              )}
              {role === "pe-board" && <PEBoardView model={model} />}
              {role === "cfo" && <CFOView model={model} />}
              {role === "opco-md" && <OpcoMDView model={model} />}
              {role === "project-lead" && <ProjectLeadView model={model} />}
            </>
          )}

          <footer className="flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Accrual basis:</span>{" "}
              Pidgecast forecasts recognized revenue timing, not cash
              collection. No bank balance, AR aging or payment lag is modelled
              in this version.
            </p>
            <p>
              Covenant headroom is measured against a configurable demo revenue
              floor. Weather is fetched live from Open-Meteo and translated into
              executable crew capacity.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
