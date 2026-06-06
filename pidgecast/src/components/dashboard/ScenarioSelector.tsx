"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCENARIOS, SCENARIO_CONFIG } from "@/lib/config";
import type { Scenario } from "@/lib/types";

interface ScenarioSelectorProps {
  value: Scenario;
  onChange: (scenario: Scenario) => void;
}

const SCENARIO_DOT: Record<Scenario, string> = {
  base: "bg-[var(--scenario-base)]",
  "wet-quarter": "bg-[var(--scenario-wet)]",
  "dry-quarter": "bg-[var(--scenario-dry)]",
};

export function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Scenario
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as Scenario)}>
        <SelectTrigger
          aria-label="Select scenario"
          className="h-10 w-full min-w-[180px] gap-2 bg-card pl-3 text-sm font-medium shadow-sm transition-all hover:shadow-md sm:w-[200px]"
        >
          <span
            className={`size-2.5 shrink-0 rounded-full ${SCENARIO_DOT[value]}`}
            aria-hidden="true"
          />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[220px]">
          {SCENARIOS.map((s) => (
            <SelectItem
              key={s}
              value={s}
              textValue={SCENARIO_CONFIG[s].label}
              className="py-2"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${SCENARIO_DOT[s]}`}
                  aria-hidden="true"
                />
                {SCENARIO_CONFIG[s].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
